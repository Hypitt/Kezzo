import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, UUID_RE } from './_lib/server';
import { validOptOut } from './_lib/optout';

/**
 * GET  /api/email-optout?u=<userId>&s=<signature>  shows a confirmation page (so mail scanners opening the link change nothing)
 * POST /api/email-optout?u=<userId>&s=<signature>  turns the message emails off (the page button, and mail apps' one-click unsubscribe)
 */
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kezzo</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 20px;color:#111">${body}
<p style="font-size:12px;color:#666;margin-top:32px">Kezzo · WeDIL Inc., Montréal, Québec</p></body></html>`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const u = String(req.query.u ?? '');
  const s = String(req.query.s ?? '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).send(page('<p>Method not allowed.</p>'));
      return;
    }
    if (!UUID_RE.test(u) || !s || !validOptOut(u, s)) {
      res.status(400).send(page('<h1>Invalid link</h1><p>This link is not valid. Open Kezzo → Profile → Settings and untick the email option instead.<br>Ce lien n’est pas valide. Ouvrez Kezzo → Profil → Paramètres et décochez l’option courriel.</p>'));
      return;
    }
    if (req.method === 'GET') {
      res.status(200).send(page(`<h1>Stop message emails?</h1><p>You will no longer get emails about new messages from Kezzo. You can turn them back on any time in Profile → Settings.</p>
<form method="post" action="/api/email-optout?u=${u}&s=${s}"><button style="background:#000;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-weight:bold;font-size:16px;cursor:pointer">Turn off message emails</button></form>
<hr style="margin:28px 0;border:0;border-top:1px solid #ddd"><h1>Arrêter les courriels de messages?</h1><p>Vous ne recevrez plus de courriels de Kezzo pour les nouveaux messages. Vous pouvez les réactiver en tout temps dans Profil → Paramètres.</p>`));
      return;
    }
    const { error } = await adminClient().from('profiles').update({ email_messages: false }).eq('id', u);
    if (error) throw error;
    res.status(200).send(page('<h1>Done</h1><p>You will no longer get emails about new messages. You can turn them back on in Kezzo → Profile → Settings.</p><p>C’est fait. Vous ne recevrez plus de courriels pour les nouveaux messages. Vous pouvez les réactiver dans Kezzo → Profil → Paramètres.</p>'));
  } catch (err) {
    console.error(err);
    res.status(500).send(page('<p>Something went wrong. Please try again later.</p>'));
  }
}
