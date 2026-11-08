import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient } from './_lib/server';

/** Only a signed-in administrator sees host names and error text; everyone else gets yes/no answers. */
async function isAdmin(req: VercelRequest): Promise<boolean> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return false;
  try {
    const db = adminClient();
    const { data } = await db.auth.getUser(token);
    if (!data.user) return false;
    const { data: row } = await db.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
    return Boolean(row);
  } catch {
    return false;
  }
}

const host = (u?: string): string | null => {
  try { return u ? new URL(u).host : null; } catch { return null; }
};

/** Reports which integrations are configured and whether the server can really talk to Supabase (never returns secret values). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const e = process.env;
  const admin = await isAdmin(req);
  // Public answers may be shared by the CDN for half a minute, so this page cannot be used to hammer the database.
  res.setHeader('Cache-Control', admin ? 'no-store' : 'public, s-maxage=30');
  const serverHost = host(e.SUPABASE_URL || e.VITE_SUPABASE_URL);
  const siteHost = host(e.VITE_SUPABASE_URL);

  // Can the server key really read this project? (This is what "Invalid or expired session" depends on.)
  let supabaseWorks: boolean | string = false;
  try {
    const { error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    supabaseWorks = error ? (admin ? `no: ${error.message.slice(0, 100)}` : false) : true;
  } catch (err) {
    supabaseWorks = admin ? `no: ${(err as Error).message.slice(0, 100)}` : false;
  }

  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    supabase: Boolean((e.SUPABASE_URL || e.VITE_SUPABASE_URL) && e.SUPABASE_SERVICE_ROLE_KEY),
    supabase_server_works: supabaseWorks,
    ...(admin ? { supabase_host_server: serverHost, supabase_host_site: siteHost } : {}),
    supabase_hosts_match: serverHost && siteHost ? serverHost === siteHost : null,
    livekit: Boolean(e.LIVEKIT_URL && e.LIVEKIT_API_KEY && e.LIVEKIT_API_SECRET),
    gemini: Boolean(e.GEMINI_API_KEY),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
  });
}
