import { createHash } from 'node:crypto';
import { authenticate, HttpError, readBody, route, UUID_RE } from './_lib/server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * POST /api/translate
 *   { action: 'text', target: 'fr', items: [{ t: 'Hello', s: 'en' }, ...] }  -> { out: ['Bonjour', ...] }
 *   { action: 'segments', postId, target }                                     -> { segments: [{ s, e, t }], lang }
 *   { action: 'transcribe', audio: '<base64 WAV, 16 kHz mono, up to 45 s>' }   -> { text, lang, segments: [{ s, e, t }] }
 * Uses Cloudflare Workers AI (translation: m2m100, speech to text: whisper). Every translation is saved, so the
 * same text is translated once per language. Each person has a daily limit.
 */

const LANGS = ['en', 'fr', 'es', 'pt', 'hi'] as const;
const NAMES: Record<string, string> = { en: 'english', fr: 'french', es: 'spanish', pt: 'portuguese', hi: 'hindi' };
const MAX_ITEMS = 25;
const MAX_CHARS = 2000;
const DAY_TEXTS = 600;      // texts one person can have translated per day
const DAY_CHUNKS = 60;      // 45-second pieces of speech one person can transcribe per day
const PIECE = 350;          // the translation model works best on short pieces

interface Cue { s: number; e: number; t: string }

function ai(): { url: (model: string) => string; token: string } {
  const account = process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CF_AI_TOKEN;
  if (!account || !token) throw new HttpError(503, 'AI translation is not configured on the server');
  return { url: (model) => `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, token };
}

async function run(model: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { url, token } = ai();
  const res = await fetch(url(model), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: Record<string, unknown>; errors?: { message?: string }[] };
  if (!res.ok || json.success === false || !json.result) {
    const msg = json.errors?.[0]?.message ?? `AI request failed (${res.status})`;
    throw new HttpError(res.status === 429 ? 429 : 502, msg);
  }
  return json.result;
}

/** Splits text into short pieces at sentence ends, so long posts are not cut off by the model. */
function pieces(text: string): string[] {
  const parts = text.split(/(?<=[.!?।…])\s+|\n+/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (p.length > PIECE) {
      if (cur) { out.push(cur); cur = ''; }
      for (let i = 0; i < p.length; i += PIECE) out.push(p.slice(i, i + PIECE));
      continue;
    }
    if (cur && cur.length + p.length + 1 > PIECE) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

async function translatePiece(text: string, source: string, target: string): Promise<string> {
  const attempt = async (s: string, t: string) => {
    const r = await run('@cf/meta/m2m100-1.2b', { text, source_lang: s, target_lang: t });
    const out = r.translated_text;
    if (typeof out !== 'string' || !out) throw new HttpError(502, 'Empty translation');
    return out;
  };
  try {
    return await attempt(source, target);
  } catch (err) {
    // some model versions expect language names instead of codes
    if (err instanceof HttpError && err.status === 429) throw err;
    return attempt(NAMES[source] ?? source, NAMES[target] ?? target);
  }
}

const hash = (source: string, text: string) => createHash('sha256').update(`${source}|${text}`).digest('hex');

/** Translates many texts using the saved ones first. Returns the texts in the same order. */
async function translateMany(db: SupabaseClient, items: { t: string; s: string }[], target: string): Promise<string[]> {
  const out: string[] = items.map((i) => i.t);
  const todo = items.map((it, idx) => ({ ...it, idx, h: hash(it.s, it.t) })).filter((x) => x.s !== target && x.t.trim());
  if (!todo.length) return out;
  const { data: saved } = await db.from('translations').select('h,body').eq('lang', target).in('h', [...new Set(todo.map((x) => x.h))]);
  const have = new Map((saved ?? []).map((r) => [r.h as string, r.body as string]));
  const fresh: { h: string; lang: string; body: string }[] = [];
  const queue = todo.filter((x) => !have.has(x.h));
  const done = new Map<string, string>();
  let next = 0;
  const worker = async () => {
    while (next < queue.length) {
      const x = queue[next++];
      if (done.has(x.h)) continue;
      const parts = pieces(x.t);
      const tr: string[] = [];
      for (const p of parts) tr.push(await translatePiece(p, x.s, target));
      const body = tr.join(' ');
      done.set(x.h, body);
      fresh.push({ h: x.h, lang: target, body });
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (fresh.length) await db.from('translations').upsert(fresh, { onConflict: 'h,lang', ignoreDuplicates: true });
  for (const x of todo) out[x.idx] = have.get(x.h) ?? done.get(x.h) ?? x.t;
  return out;
}

function parseVtt(vtt: string): Cue[] {
  const cues: Cue[] = [];
  const time = (v: string) => { const p = v.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
  for (const block of vtt.split(/\r?\n\r?\n/)) {
    const m = block.match(/([\d:.]+)\s*-->\s*([\d:.]+)\s*\r?\n([\s\S]+)/);
    if (m) cues.push({ s: time(m[1]), e: time(m[2]), t: m[3].replace(/\s+/g, ' ').trim() });
  }
  return cues.filter((c) => c.t);
}

export default route(async (req, res) => {
  const { user, db } = await authenticate(req);
  const body = readBody(req);
  const action = String(body.action ?? '');
  const target = String(body.target ?? 'en');

  if (action === 'text') {
    if (!(LANGS as readonly string[]).includes(target)) throw new HttpError(400, 'Unsupported language');
    const raw = Array.isArray(body.items) ? body.items : [];
    if (raw.length === 0 || raw.length > MAX_ITEMS) throw new HttpError(400, 'Between 1 and 25 texts');
    const items = raw.map((r) => {
      const o = r as { t?: unknown; s?: unknown };
      const t = String(o.t ?? '').slice(0, MAX_CHARS);
      const s = String(o.s ?? '');
      if (!/^[a-z]{2,3}$/.test(s)) throw new HttpError(400, 'Unknown source language');
      return { t, s };
    });
    const { data: ok } = await db.rpc('ai_take', { p_user: user.id, p_n: items.length, p_cap: DAY_TEXTS });
    if (ok === false) throw new HttpError(429, 'Daily translation limit reached');
    res.status(200).json({ out: await translateMany(db, items, target) });
    return;
  }

  if (action === 'segments') {
    const postId = String(body.postId ?? '');
    if (!UUID_RE.test(postId) || !(LANGS as readonly string[]).includes(target)) throw new HttpError(400, 'Invalid request');
    const { data: tr } = await db.from('post_transcripts').select('lang,segments,posts!inner(download_price,media_bucket)').eq('post_id', postId).maybeSingle();
    const post = (tr as unknown as { posts?: { download_price: number; media_bucket: string | null } } | null)?.posts;
    if (!tr || !post || post.download_price !== 0 || post.media_bucket !== 'media-public') throw new HttpError(404, 'No transcript');
    const lang = String(tr.lang);
    const segs = (tr.segments as Cue[]).slice(0, 300);
    if (lang === target || !/^[a-z]{2,3}$/.test(lang)) { res.status(200).json({ lang, segments: segs }); return; }
    const { data: ok } = await db.rpc('ai_take', { p_user: user.id, p_n: Math.ceil(segs.length / 4), p_cap: DAY_TEXTS });
    if (ok === false) throw new HttpError(429, 'Daily translation limit reached');
    const out = await translateMany(db, segs.map((c) => ({ t: String(c.t).slice(0, MAX_CHARS), s: lang })), target);
    res.status(200).json({ lang, segments: segs.map((c, i) => ({ s: c.s, e: c.e, t: out[i] })) });
    return;
  }

  if (action === 'transcribe') {
    const audio = String(body.audio ?? '');
    if (!audio || audio.length > 3_000_000) throw new HttpError(413, 'Audio piece too large');
    const { data: ok } = await db.rpc('ai_take', { p_user: user.id, p_n: 1, p_cap: DAY_CHUNKS });
    if (ok === false) throw new HttpError(429, 'Daily subtitle limit reached');
    const r = await run('@cf/openai/whisper-large-v3-turbo', { audio, task: 'transcribe', vad_filter: true });
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    const info = (r.transcription_info ?? {}) as { language?: string; duration?: number };
    let cues: Cue[] = [];
    if (Array.isArray(r.segments)) {
      cues = (r.segments as { start?: number; end?: number; text?: string }[])
        .map((g) => ({ s: Number(g.start ?? 0), e: Number(g.end ?? 0), t: String(g.text ?? '').trim() })).filter((c) => c.t);
    }
    if (!cues.length && typeof r.vtt === 'string') cues = parseVtt(r.vtt);
    if (!cues.length && text) cues = [{ s: 0, e: Number(info.duration ?? 45), t: text }];
    const lang = typeof info.language === 'string' && /^[a-z]{2,3}$/.test(info.language) ? info.language : 'en';
    res.status(200).json({ text, lang, segments: cues });
    return;
  }

  throw new HttpError(400, 'Unknown action');
});
