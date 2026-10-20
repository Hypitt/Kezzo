import { adminClient, authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';

/**
 * POST /api/notify-message  { messageId }
 * Called by the sender's browser right after a direct message is saved. Sends the recipient a short email
 * ("X sent you a message") unless they turned it off, blocked the sender, or were already emailed about this
 * sender in the last 30 minutes. The email never contains the message text.
 * Needs RESEND_API_KEY and EMAIL_FROM; without them it quietly does nothing.
 */
const WINDOW_MIN = 30;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function siteUrl(host: string | undefined): string {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  if (configured && /^https?:\/\//.test(configured)) return configured;
  return `https://${host ?? 'kezzo.vercel.app'}`;
}

export default route(async (req, res) => {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    res.status(200).json({ sent: false, reason: 'not_configured' });
    return;
  }
  const { user, db } = await authenticate(req);
  const messageId = String(readBody(req).messageId ?? '');
  if (!UUID_RE.test(messageId)) throw new HttpError(400, 'Invalid request');

  const { data: msg } = await db.from('direct_messages').select('id,sender_id,recipient_id,created_at,read_at').eq('id', messageId).maybeSingle();
  if (!msg || msg.sender_id !== user.id) throw new HttpError(404, 'Message not found');
  const skip = (reason: string) => res.status(200).json({ sent: false, reason });
  if (Date.now() - new Date(msg.created_at).getTime() > 2 * 60_000 || msg.read_at) return skip('not_needed');

  const [{ data: to }, { data: from_ }, { data: blocked }] = await Promise.all([
    db.from('profiles').select('id,display_name,language,email_messages').eq('id', msg.recipient_id).maybeSingle(),
    db.from('profiles').select('id,display_name').eq('id', msg.sender_id).maybeSingle(),
    db.from('blocks').select('blocker_id').or(`and(blocker_id.eq.${msg.recipient_id},blocked_id.eq.${msg.sender_id}),and(blocker_id.eq.${msg.sender_id},blocked_id.eq.${msg.recipient_id})`).limit(1),
  ]);
  if (!to || !from_ || !to.email_messages || (blocked?.length ?? 0) > 0) return skip('not_allowed');

  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await db.from('email_log').select('id', { count: 'exact', head: true })
    .eq('recipient_id', msg.recipient_id).eq('sender_id', msg.sender_id).eq('kind', 'message').gte('sent_at', since);
  if ((count ?? 0) > 0) return skip('throttled');

  const { data: account } = await adminClient().auth.admin.getUserById(msg.recipient_id);
  const email = account.user?.email;
  if (!email) return skip('no_email');

  // Reserve the slot first so two quick messages cannot both send an email.
  const { data: slot, error: slotError } = await db.from('email_log').insert({ recipient_id: msg.recipient_id, sender_id: msg.sender_id, kind: 'message' }).select('id').single();
  if (slotError || !slot) throw new HttpError(500, 'Could not record the email');

  const fr = to.language === 'fr';
  const name = from_.display_name;
  const link = `${siteUrl(req.headers.host)}/#/messages/${msg.sender_id}`;
  const subject = fr ? `${name} vous a envoyé un message sur Kezzo` : `${name} sent you a message on Kezzo`;
  const lines = fr
    ? { hi: `Bonjour ${to.display_name},`, body: `${name} vous a envoyé un message sur Kezzo.`, cta: 'Ouvrir la conversation', foot: 'Vous recevez ce courriel parce que quelqu’un vous a écrit. Pour ne plus en recevoir : Kezzo → Profil → Paramètres → « Me envoyer un courriel pour les nouveaux messages ».' }
    : { hi: `Hi ${to.display_name},`, body: `${name} sent you a message on Kezzo.`, cta: 'Open the conversation', foot: 'You get this email because someone messaged you. To stop these emails: Kezzo → Profile → Settings → “Email me about new messages”.' };
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<p style="font-size:16px">${esc(lines.hi)}</p>
<p style="font-size:16px"><strong>${esc(name)}</strong> ${esc(lines.body.slice(name.length + 1))}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#000;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(lines.cta)}</a></p>
<p style="font-size:12px;color:#666">${esc(lines.foot)}</p>
<p style="font-size:12px;color:#666">Kezzo · WeDIL Inc., Montréal, Québec</p></div>`;
  const textBody = `${lines.hi}\n\n${lines.body}\n${lines.cta}: ${link}\n\n${lines.foot}\nKezzo · WeDIL Inc., Montréal, Québec`;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject, html, text: textBody }),
  });
  if (!resp.ok) {
    await db.from('email_log').delete().eq('id', slot.id); // free the slot so a later message can try again
    console.error('Resend refused the email', resp.status, await resp.text().catch(() => ''));
    throw new HttpError(502, 'Email service refused the message');
  }

  if (Math.random() < 0.05) await db.from('email_log').delete().lt('sent_at', new Date(Date.now() - 7 * 86_400_000).toISOString());
  res.status(200).json({ sent: true });
});
