import { authenticate, HttpError, readBody, route } from './_lib/server';
import { deleteObject, listKeys, r2Env } from './_lib/r2';

/**
 * POST /api/r2-delete  { paths: ["<user id>/r-<name>.<ext>", ...] }  or  { all: true }
 * Deletes files from Cloudflare R2. People can only delete files inside their own folder.
 * { all: true } removes everything the person stored (used when an account is deleted).
 */
export default route(async (req, res) => {
  const env = r2Env();
  if (!env) {
    res.status(200).json({ deleted: 0 });
    return;
  }
  const { user } = await authenticate(req);
  const body = readBody(req);
  let keys: string[];
  if (body.all === true) {
    keys = (await listKeys(env, `${user.id}/`)).filter((k) => k.startsWith(`${user.id}/`));
  } else {
    const paths = Array.isArray(body.paths) ? body.paths.map(String) : [];
    if (paths.length > 60) throw new HttpError(400, 'Too many files at once');
    keys = paths.filter((p) => p.startsWith(`${user.id}/r-`) && !p.includes('..') && p.split('/').length === 2);
  }
  let deleted = 0;
  for (const key of keys) {
    try {
      await deleteObject(env, key);
      deleted += 1;
    } catch (err) {
      console.error(err);
    }
  }
  res.status(200).json({ deleted });
});
