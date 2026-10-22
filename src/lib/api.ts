import { supabase } from './supabase';

/** Calls one of our serverless routes with the signed-in user's access token. */
export async function api<T>(path: string, body: unknown): Promise<T> {
  const send = (token: string | undefined) => fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const { data } = await supabase.auth.getSession();
  let res = await send(data.session?.access_token);
  if (res.status === 401) {
    // The saved sign-in may have just expired: refresh it once and try again.
    const fresh = await supabase.auth.refreshSession();
    if (fresh.data.session) res = await send(fresh.data.session.access_token);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
