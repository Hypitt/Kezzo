import { adminClient, authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { optOutSignature } from './_lib/optout';

/**
 * POST /api/notify-message  { messageId }       a direct message just sent
 *                           { chatMessageId }   a group chat message just sent
 * Called by the sender's browser right after the message is saved. Emails the people who should know, with a
 * generic text: no sender name, no group name and no message text. Skipped for people who turned the emails off,
 * who blocked (or were blocked by) the sender, or who were already emailed about this conversation or group in
 * the last 30 minutes. Needs RESEND_API_KEY and EMAIL_FROM; without them it quietly does nothing.
 */
const WINDOW_MIN = 30;
const MAX_GROUP_RECIPIENTS = 100; // one Resend batch

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function siteUrl(host: string | undefined): string {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\//.test(configured)) return configured;
  return `https://${host ?? 'kezzo.vercel.app'}`;
}

interface Person { id: string; display_name: string; language: string }

function compose(person: Person, link: string, optOut: string) {
  const fr = person.language === 'fr';
  const t = fr
    ? {
        subject: 'Vous avez un nouveau message sur Kezzo',
        hi: `Bonjour ${person.display_name},`,
        head: 'Vous avez un nouveau message',
        body: 'Un nouveau message vous attend sur Kezzo. Ouvrez l’application pour le lire et répondre.',
        cta: 'Ouvrir Kezzo',
        foot: 'Vous recevez ce courriel parce que les notifications par courriel pour les nouveaux messages sont activées.',
        off: 'Ne plus recevoir ces courriels',
        where: 'Vous pouvez aussi les désactiver dans Kezzo → Profil → Paramètres.',
      }
    : {
        subject: 'You have a new message on Kezzo',
        hi: `Hi ${person.display_name},`,
        head: 'You have a new message',
        body: 'A new message is waiting for you on Kezzo. Open the app to read it and reply.',
        cta: 'Open Kezzo',
        foot: 'You get this email because email notifications for new messages are turned on.',
        off: 'Stop these emails',
        where: 'You can also turn them off in Kezzo → Profile → Settings.',
      };
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(t.body)}</span>
<h1 style="font-size:22px;margin:0 0 16px">${esc(t.head)}</h1>
<p style="font-size:16px;margin:0 0 8px">${esc(t.hi)}</p>
<p style="font-size:16px;line-height:1.5;margin:0">${esc(t.body)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#000;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${esc(t.cta)}</a></p>
<p style="font-size:12px;color:#666;line-height:1.5">${esc(t.foot)} <a href="${esc(optOut)}" style="color:#666">${esc(t.off)}</a>. ${esc(t.where)}</p>
<p style="font-size:12px;color:#666">Kezzo · WeDIL Inc., Montréal, Québec</p></div>`;
  const text = `${t.head}\n\n${t.hi}\n${t.body}\n\n${t.cta}: ${link}\n\n${t.foot}\n${t.off}: ${optOut}\n${t.where}\nKezzo · WeDIL Inc., Montréal, Québec`;
  return { subject: t.subject, html, text };
}

export default route(async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    res.status(200).json({ sent: false, reason: 'not_configured' });
    return;
  }
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const skip = (reason: string) => res.status(200).json({ sent: false, reason });
  const fresh = (iso: string) => Date.now() - new Date(iso).getTime() <= 2 * 60_000;
  const site = siteUrl(req.headers.host);
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

  // 1. Work out who should be emailed, what to throttle on, and where the button goes.
  let candidates: string[] = [];
  let link = `${site}/#/messages`;
  let kind: 'message' | 'group' = 'message';
  let roomId: string | null = null;

  if (typeof body.messageId === 'string') {
    if (!UUID_RE.test(body.messageId)) throw new HttpError(400, 'Invalid request');
    const { data: m } = await db.from('direct_messages').select('sender_id,recipient_id,created_at,read_at').eq('id', body.messageId).maybeSingle();
    if (!m || m.sender_id !== user.id) throw new HttpError(404, 'Message not found');
    if (!fresh(m.created_at) || m.read_at) return skip('not_needed');
    candidates = [m.recipient_id];
  } else if (typeof body.chatMessageId === 'string') {
    if (!UUID_RE.test(body.chatMessageId)) throw new HttpError(400, 'Invalid request');
    const { data: m } = await db.from('chat_messages').select('author_id,room_type,room_id,created_at').eq('id', body.chatMessageId).maybeSingle();
    if (!m || m.author_id !== user.id) throw new HttpError(404, 'Message not found');
    if (m.room_type !== 'group' || !fresh(m.created_at)) return skip('not_needed');
    const { data: members } = await db.from('group_members').select('user_id').eq('group_id', m.room_id).neq('user_id', user.id).limit(1000);
    candidates = (members ?? []).map((r) => r.user_id as string);
    kind = 'group';
    roomId = m.room_id;
    link = `${site}/#/groups/${m.room_id}`;
  } else {
    throw new HttpError(400, 'Invalid request');
  }
  if (candidates.length === 0) return skip('nobody');

  // 2. Keep only people who want the email, are not blocking each other, and were not emailed recently.
  const [people$, blocks$, recent$] = await Promise.all([
    db.from('profiles').select('id,display_name,language,email_messages').in('id', candidates).eq('email_messages', true),
    db.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),
    kind === 'group'
      ? db.from('email_log').select('recipient_id').eq('kind', 'group').eq('room_id', roomId).gte('sent_at', since).in('recipient_id', candidates)
      : db.from('email_log').select('recipient_id').eq('kind', 'message').eq('sender_id', user.id).gte('sent_at', since).in('recipient_id', candidates),
  ]);
  // A database error here almost always means supabase/update-6.sql has not been run yet. Say so in the logs instead of silently doing nothing.
  const failed = people$.error ?? blocks$.error ?? recent$.error;
  if (failed) {
    console.error('notify-message: database query failed. Has supabase/update-6.sql been run?', failed.message);
    throw new HttpError(500, 'Email notifications are not set up in the database yet');
  }
  const people = people$.data;
  const blocks = blocks$.data;
  const recent = recent$.data;
  const blockedIds = new Set((blocks ?? []).flatMap((b) => [b.blocker_id as string, b.blocked_id as string]));
  const throttled = new Set((recent ?? []).map((r) => r.recipient_id as string));
  const targets = (people ?? []).filter((p) => !blockedIds.has(p.id) && !throttled.has(p.id)).slice(0, MAX_GROUP_RECIPIENTS) as Person[];
  if (targets.length === 0) return skip('not_allowed');

  // 3. Reserve the slots first so two quick messages cannot both send an email.
  const { data: slots, error: slotError } = await db.from('email_log')
    .insert(targets.map((p) => ({ recipient_id: p.id, sender_id: kind === 'message' ? user.id : null, room_id: roomId, kind })))
    .select('id');
  if (slotError || !slots) throw new HttpError(500, 'Could not record the email');
  const free = async () => { await db.from('email_log').delete().in('id', slots.map((s) => s.id as number)); };

  // 4. Find their addresses and send everything in one batch.
  const admin = adminClient();
  const emails = await Promise.all(targets.map(async (p) => (await admin.auth.admin.getUserById(p.id)).data.user?.email ?? null));
  const batch = targets.flatMap((p, i) => {
    const to = emails[i];
    if (!to) return [];
    const optOut = `${site}/api/email-optout?u=${p.id}&s=${optOutSignature(p.id)}`;
    const mail = compose(p, link, optOut);
    return [{
      from, to: [to], subject: mail.subject, html: mail.html, text: mail.text,
      headers: { 'List-Unsubscribe': `<${optOut}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }];
  });
  if (batch.length === 0) {
    await free();
    return skip('no_email');
  }
  const resp = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!resp.ok) {
    await free(); // free the slots so a later message can try again
    console.error('Resend refused the emails', resp.status, await resp.text().catch(() => ''));
    throw new HttpError(502, 'Email service refused the message');
  }

  if (Math.random() < 0.05) await db.from('email_log').delete().lt('sent_at', new Date(Date.now() - 7 * 86_400_000).toISOString());
  res.status(200).json({ sent: true, count: batch.length });
});
