import { readBody, route } from './_lib/server';
import { del } from './_lib/r2-del';
import { migrate } from './_lib/r2-migrate';
import { sign } from './_lib/r2-sign';

/**
 * One endpoint for everything Cloudflare R2 (Vercel's free plan allows only 12 server functions):
 *   POST /api/r2  { action: "sign",    path, contentType, size }   -> one-time upload link
 *   POST /api/r2  { action: "delete",  paths | all }               -> delete files
 *   POST /api/r2  { action: "migrate", kind, skip }                -> admins: move old Supabase files to R2
 */
export default route(async (req, res) => {
  const action = readBody(req).action;
  if (action === 'delete') return del(req, res);
  if (action === 'migrate') return migrate(req, res);
  return sign(req, res);
});
