import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Reports which integrations are configured (never returns secret values). */
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const e = process.env;
  res.status(200).json({
    status: 'ok',
    time: new Date().toISOString(),
    supabase: Boolean((e.SUPABASE_URL || e.VITE_SUPABASE_URL) && e.SUPABASE_SERVICE_ROLE_KEY),
    livekit: Boolean(e.LIVEKIT_URL && e.LIVEKIT_API_KEY && e.LIVEKIT_API_SECRET),
    gemini: Boolean(e.GEMINI_API_KEY),
  });
}
