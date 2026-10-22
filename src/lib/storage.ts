import { supabase } from './supabase';
import { api } from './api';

/**
 * Where public pictures and videos live.
 *   - Files uploaded before R2 was set up stay in Supabase Storage and keep working.
 *   - When VITE_R2_PUBLIC_URL is set (the public address of your Cloudflare R2 bucket), NEW public files go to R2:
 *     it has no download fees, which keeps Supabase inside its free plan.
 * R2 files are recognised by their name: "<user id>/r-<name>". (The folder part stays "<user id>/" because the database requires it.)
 */
export const R2_URL = ((import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ?? '').trim().replace(/\/$/, '');
export const r2Enabled = R2_URL !== '';

const R2_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/r-/i;
export const isR2Path = (path: string | null | undefined): boolean => Boolean(path) && R2_NAME.test(path as string);

/** The storage path for a new public file of this person. */
export const publicFilePath = (userId: string, name: string): string => `${userId}/${r2Enabled ? 'r-' : ''}${name}`;

/** Public web address of a stored file. */
export function publicUrl(bucket: string, path: string): string {
  if (isR2Path(path) && r2Enabled) return `${R2_URL}/${path}`;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** The storage path behind a public address made by publicUrl (or null for other addresses). */
export function pathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  if (r2Enabled && url.startsWith(`${R2_URL}/`)) return decodeURIComponent(url.slice(R2_URL.length + 1));
  const part = url.split(`/object/public/${bucket}/`)[1];
  return part ? decodeURIComponent(part) : null;
}

/** Deletes public files, wherever they are stored. Never throws (cleanup is best effort). */
export async function removePublic(bucket: string, paths: Array<string | null | undefined>): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p));
  const r2 = list.filter(isR2Path);
  const supa = list.filter((p) => !isR2Path(p));
  await Promise.all([
    supa.length ? supabase.storage.from(bucket).remove(supa).then(() => undefined, () => undefined) : Promise.resolve(),
    r2.length ? api('r2-delete', { paths: r2 }).then(() => undefined, () => undefined) : Promise.resolve(),
  ]);
}
