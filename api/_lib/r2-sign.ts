import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, HttpError, readBody } from './server';
import { r2Env, uploadTarget } from './r2';

const MAX_MB = Math.min(Math.max(Number(process.env.R2_MAX_UPLOAD_MB) || 200, 1), 5000);
const TYPE_RE = /^(image|video|audio)\/[a-z0-9.+-]{1,60}$/i;

/**
 * POST /api/r2-sign  { path: "<user id>/r-<name>.<ext>", contentType, size }
 * Returns a one-time link the browser uses to upload straight to Cloudflare R2 (valid 10 minutes).
 * The server decides who may write where: only inside your own folder, only photo/video/audio, only up to the size limit.
 */
export async function sign(req: VercelRequest, res: VercelResponse): Promise<void> {
  const env = r2Env();
  if (!env) throw new HttpError(503, 'R2 is not configured');
  const { user } = await authenticate(req);
  const body = readBody(req);
  const path = String(body.path ?? '');
  const contentType = String(body.contentType ?? '');
  const size = Number(body.size);

  // "r-" in the file name marks files stored in R2 (see src/lib/storage.ts)
  if (!path.startsWith(`${user.id}/r-`) || !/^[A-Za-z0-9._\/-]{1,200}$/.test(path) || path.includes('..') || path.split('/').length !== 2) {
    throw new HttpError(403, 'Not your folder');
  }
  if (!TYPE_RE.test(contentType)) throw new HttpError(415, 'Only photo, video and audio files are allowed');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_MB * 1024 * 1024) throw new HttpError(413, `Files can be up to ${MAX_MB} MB`);

  const target = uploadTarget(env, path, contentType);
  res.status(200).json({ url: target.url, headers: target.headers });
}
