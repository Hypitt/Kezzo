/**
 * One-off clean-up to save Supabase bandwidth: shrinks photos that are already stored.
 *   - profile photos (bucket "avatars") to 256 px
 *   - post photos (bucket "media-public") to 1600 px, and adds a small preview next to each ("<name>-t.jpg")
 * Videos and GIFs are left alone. Files keep the same name, so no link changes.
 *
 * Run on your own computer (not on Vercel):
 *   npm install --no-save sharp
 *   node --env-file=.env.local scripts/shrink-storage.mjs            # dry run: only shows what it would do
 *   node --env-file=.env.local scripts/shrink-storage.mjs --apply    # really does it
 * It needs SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env.local (never commit that file).
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (put them in .env.local).');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const CACHE = '31536000';

async function listAll(bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(bucket, path))); // a folder
      else out.push({ path, size: item.metadata?.size ?? 0, type: item.metadata?.mimetype ?? '' });
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function run(bucket, maxSide, minBytes, makeThumbs) {
  const files = await listAll(bucket);
  const names = new Set(files.map((f) => f.path));
  let saved = 0;
  let touched = 0;
  for (const f of files) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || /-t\.jpg$/.test(f.path)) continue;
    const thumb = f.path.replace(/\.[^./]+$/, '') + '-t.jpg';
    const needThumb = makeThumbs && !names.has(thumb);
    const needShrink = f.size > minBytes;
    if (!needShrink && !needThumb) continue;
    const { data: blob, error } = await db.storage.from(bucket).download(f.path);
    if (error || !blob) { console.warn('skip (download failed):', bucket, f.path); continue; }
    const input = Buffer.from(await blob.arrayBuffer());
    const base = sharp(input, { failOn: 'none' }).rotate();
    if (needShrink) {
      const small = await base.clone().resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      if (small.length < input.length * 0.9) {
        console.log(`${apply ? 'shrink' : 'would shrink'} ${bucket}/${f.path}: ${(input.length / 1024).toFixed(0)} KB -> ${(small.length / 1024).toFixed(0)} KB`);
        saved += input.length - small.length;
        touched++;
        if (apply) {
          const { error: e } = await db.storage.from(bucket).upload(f.path, small, { upsert: true, contentType: 'image/jpeg', cacheControl: CACHE });
          if (e) console.warn('  upload failed:', e.message);
        }
      }
    }
    if (needThumb) {
      const t = await base.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
      console.log(`${apply ? 'add' : 'would add'} preview ${bucket}/${thumb} (${(t.length / 1024).toFixed(0)} KB)`);
      if (apply) {
        const { error: e } = await db.storage.from(bucket).upload(thumb, t, { upsert: false, contentType: 'image/jpeg', cacheControl: CACHE });
        if (e) console.warn('  preview failed:', e.message);
      }
    }
  }
  console.log(`${bucket}: ${touched} photos, about ${(saved / 1024 / 1024).toFixed(1)} MB smaller${apply ? '' : ' (dry run)'}\n`);
}

await run('avatars', 256, 40 * 1024, false);
await run('media-public', 1600, 300 * 1024, true);
if (!apply) console.log('Dry run only. Add --apply to do it for real.');
