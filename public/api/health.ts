import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient } from './_lib/server';

const host = (u?: string): string | null => {
  try { return u ? new URL(u).host : null; } catch { return null; }
};

/** Reports which integrations are configured and whether the server can really talk to Supabase (never returns secret values). */
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  const e = process.env;
  const serverHost = host(e.SUPABASE_URL || e.VITE_SUPABASE_URL);
  const siteHost = host(e.VITE_SUPABASE_URL);

  // Can the server key really read this project? (This is what "Invalid or expired session" depends on.)
  let supabaseWorks: boolean | string = false;
  try {
    const { error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    supabaseWorks = error ? `no: ${error.message.slice(0, 100)}` : true;
  } catch (err) {
    supabaseWorks = `no: ${(err as Error).message.slice(0, 100)}`;
  }

  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    supabase: Boolean((e.SUPABASE_URL || e.VITE_SUPABASE_URL) && e.SUPABASE_SERVICE_ROLE_KEY),
    supabase_server_works: supabaseWorks,
    supabase_host_server: serverHost,
    supabase_host_site: siteHost,
    supabase_hosts_match: serverHost && siteHost ? serverHost === siteHost : null,
    livekit: Boolean(e.LIVEKIT_URL && e.LIVEKIT_API_KEY && e.LIVEKIT_API_SECRET),
    gemini: Boolean(e.GEMINI_API_KEY),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
  });
}
