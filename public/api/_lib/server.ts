import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>;

/** Wraps a handler with method checking and uniform JSON error responses. */
export function route(fn: Handler, method = 'POST') {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    try {
      if (req.method !== method) {
        res.setHeader('Allow', method);
        throw new HttpError(405, 'Method not allowed');
      }
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
      } else {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

export function readBody(req: VercelRequest): Record<string, unknown> {
  const raw: unknown = req.body;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
  }
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/** Service-role client. Server only: it bypasses RLS, so always authorize in code first. */
export function adminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(503, 'Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Verifies the caller's Supabase access token and returns the user plus an admin client. */
export async function authenticate(req: VercelRequest): Promise<{ user: User; db: SupabaseClient }> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Sign in required');
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, `Invalid or expired session${error?.message ? ` (${error.message.slice(0, 120)})` : ''}`);
  return { user: data.user, db };
}
