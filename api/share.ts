import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminClient, UUID_RE } from './_lib/server';

/**
 * GET /s/<type>/<id>  (rewritten to /api/share?type=&id=)
 * The link people paste into TikTok, Instagram, Facebook, WhatsApp, X ... Social apps read the preview tags
 * (title, picture, Kezzo name) from this page; real visitors are sent straight on to the app.
 * Only public details are used: a post's title, its photo when the post is free, a profile's name and picture.
 */
const TARGET: Record<string, string> = { post: 'post', profile: 'profile', battle: 'battles', live: 'live', group: 'groups' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c] as string);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const q = (k: string) => String(Array.isArray(req.query[k]) ? req.query[k]?.[0] : req.query[k] ?? '');
  const type = q('type');
  const id = q('id');
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').split(',')[0].trim();
  const base = (process.env.SITE_URL?.trim().replace(/\/+$/, '')) || (host ? `https://${host}` : '');
  const target = TARGET[type];

  if (!target || !UUID_RE.test(id)) {
    res.redirect(302, base ? `${base}/` : '/');
    return;
  }

  let title = 'Kezzo';
  let description = 'Social is better when you’re in it. Join Kezzo.';
  let image = `${base}/og.png`;

  try {
    const db = adminClient();
    const supaUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
    if (type === 'post') {
      const { data } = await db.from('posts')
        .select('title,kind,media_bucket,media_path,download_price,author:profiles!author_id(display_name)').eq('id', id).maybeSingle();
      if (data) {
        const author = one(data.author as { display_name: string } | { display_name: string }[] | null);
        title = clip(String(data.title), 90);
        description = `${author?.display_name ?? 'Someone'} on Kezzo`;
        if (data.kind === 'photo' && data.media_bucket === 'media-public' && data.media_path && !data.download_price && supaUrl) {
          image = `${supaUrl}/storage/v1/object/public/media-public/${data.media_path}`;
        }
      }
    } else if (type === 'profile') {
      const { data } = await db.from('profiles').select('display_name,handle,avatar_url').eq('id', id).maybeSingle();
      if (data) {
        title = `${clip(String(data.display_name), 60)} (@${data.handle})`;
        description = 'See their posts, lives and battles on Kezzo.';
        if (typeof data.avatar_url === 'string' && /^https:\/\//.test(data.avatar_url)) image = data.avatar_url;
      }
    } else if (type === 'battle') {
      title = 'Join this live battle on Kezzo';
      description = 'Watch, vote and cheer. Kezzo: live creator battles.';
    } else if (type === 'live') {
      title = 'Watch this live on Kezzo';
      description = 'Join the live stream on Kezzo.';
    } else {
      title = 'Join this group on Kezzo';
      description = 'Chat, share and live together on Kezzo.';
    }
  } catch {
    /* keep the generic Kezzo preview */
  }

  const dest = `${base}/#/${target}/${id}`;
  const self = `${base}/s/${type}/${id}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} · Kezzo</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:site_name" content="Kezzo" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)} · Kezzo" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(self)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)} · Kezzo" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<meta http-equiv="refresh" content="0;url=${esc(dest)}" />
<script>location.replace(${JSON.stringify(dest).replace(/</g, '\\u003c')});</script>
</head><body style="font-family:Helvetica,Arial,sans-serif;padding:24px"><p><a href="${esc(dest)}">Open on Kezzo</a></p></body></html>`);
}
