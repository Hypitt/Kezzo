import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import { r2Env, uploadTarget } from './_lib/r2';

/** Biggest single file this tool will copy (it is held in memory while it is copied). */
const MAX_COPY_BYTES = 250 * 1024 * 1024;

const thumbOf = (p: string): string => p.replace(/\.[^.\/]+$/, '') + '-t.jpg';

/**
 * POST /api/r2-migrate  { kind: "video" | "all", skip?: string[] }   (admins only)
 * Moves ONE old public post (its picture/video, preview and extra photos) from Supabase Storage to Cloudflare R2,
 * switches the post to the new file name, then deletes the old Supabase copy.
 * The page calls it again and again until { remaining: 0 }. Nothing is deleted before the new copy is safely stored.
 */
export default route(async (req, res) => {
  const env = r2Env();
  if (!env) throw new HttpError(503, 'R2 is not configured');
  const { user, db } = await authenticate(req);
  const { data: admin } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!admin) throw new HttpError(403, 'Admins only');

  const body = readBody(req);
  const kind = body.kind === 'all' ? 'all' : 'video';
  const skip = (Array.isArray(body.skip) ? body.skip.map(String) : []).filter((s) => UUID_RE.test(s)).slice(0, 500);

  const base = () => {
    let q = db.from('posts').select('id,author_id,kind,media_path,media_extra', { count: 'exact' })
      .eq('media_bucket', 'media-public').not('media_path', 'is', null).not('media_path', 'like', '%/r-%');
    if (kind === 'video') q = q.eq('kind', 'video');
    if (skip.length) q = q.not('id', 'in', `(${skip.join(',')})`);
    return q;
  };
  const { data: rows, count, error } = await base().order('created_at', { ascending: true }).limit(1);
  if (error) throw error;
  const post = rows?.[0] as { id: string; author_id: string; kind: string; media_path: string; media_extra: string[] | null } | undefined;
  if (!post) {
    res.status(200).json({ remaining: 0, moved: null });
    return;
  }

  const rename = (p: string): string => {
    const [folder, ...rest] = p.split('/');
    return `${folder}/r-${rest.join('/')}`;
  };
  const extras = post.media_extra ?? [];
  const pairs: Array<{ from: string; to: string; optional: boolean }> = [
    { from: post.media_path, to: rename(post.media_path), optional: false },
    ...extras.map((p) => ({ from: p, to: rename(p), optional: false })),
  ];
  if (post.kind === 'photo') pairs.push({ from: thumbOf(post.media_path), to: thumbOf(rename(post.media_path)), optional: true });

  const copied: string[] = [];
  try {
    for (const { from, to, optional } of pairs) {
      if (!from.startsWith(`${post.author_id}/`)) throw new Error('unexpected path');
      const { data: blob, error: dErr } = await db.storage.from('media-public').download(from);
      if (dErr || !blob) {
        if (optional) continue;
        throw new Error(`download failed: ${dErr?.message ?? 'no file'}`);
      }
      if (blob.size > MAX_COPY_BYTES) throw new Error('file too big for this tool');
      const type = blob.type || (post.kind === 'video' ? 'video/mp4' : 'image/jpeg');
      const target = uploadTarget(env, to, type);
      const put = await fetch(target.url, { method: 'PUT', headers: target.headers, body: await blob.arrayBuffer() });
      if (!put.ok) throw new Error(`R2 upload failed (${put.status})`);
      copied.push(from);
    }
    const { error: uErr } = await db.from('posts').update({ media_path: rename(post.media_path), media_extra: extras.map(rename) }).eq('id', post.id);
    if (uErr) throw uErr;
  } catch (err) {
    console.error(err);
    res.status(200).json({ remaining: (count ?? 1) - 1, failedId: post.id, error: err instanceof Error ? err.message : 'failed' });
    return;
  }
  // The post now points to R2: remove the old Supabase copies (frees Supabase space too).
  await db.storage.from('media-public').remove(copied).catch(() => undefined);
  res.status(200).json({ remaining: Math.max((count ?? 1) - 1, 0), moved: post.id });
});
