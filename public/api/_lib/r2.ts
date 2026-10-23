import { createHash, createHmac } from 'node:crypto';

/**
 * Cloudflare R2 (S3-compatible storage), server side only. No extra packages: requests are signed here with
 * AWS Signature Version 4 "query string" signing, so the browser can upload straight to R2 with a short-lived link
 * and the secret key never leaves the server.
 */

export interface R2Env {
  account: string;
  accessKey: string;
  secret: string;
  bucket: string;
  publicUrl: string;
}

/** Returns null when R2 is not set up (the app then keeps using Supabase Storage). */
export function r2Env(): R2Env | null {
  const account = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!account || !accessKey || !secret || !bucket) return null;
  return { account, accessKey, secret, bucket, publicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '') };
}

const sha256 = (data: string): string => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/** RFC 3986 encoding as S3 expects it (spaces as %20, "/" kept only in paths). */
const enc = (s: string): string => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (p: string): string => p.split('/').map(enc).join('/');

export interface SignInput {
  host: string;
  /** Path starting with "/", not yet encoded (for example "/kezzo-media/<user>/<file>.jpg"). */
  path: string;
  method: 'GET' | 'PUT' | 'DELETE';
  accessKey: string;
  secret: string;
  region: string;
  service?: string;
  /** Extra query parameters (for example list-type and prefix). */
  query?: Record<string, string>;
  /** Headers the caller must send exactly as given (for example Content-Type). */
  headers?: Record<string, string>;
  expires?: number;
  date?: Date;
}

/** Builds a pre-signed https URL. Exported for the tests in scripts/test-r2-signing.mjs. */
export function signUrl(i: SignInput): string {
  const service = i.service ?? 's3';
  const stamp = (i.date ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20130524T000000Z
  const day = stamp.slice(0, 8);
  const scope = `${day}/${i.region}/${service}/aws4_request`;

  const headers: Record<string, string> = { host: i.host };
  for (const [k, v] of Object.entries(i.headers ?? {})) headers[k.toLowerCase()] = v.trim().replace(/\s+/g, ' ');
  const names = Object.keys(headers).sort();

  const query: Record<string, string> = {
    ...(i.query ?? {}),
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${i.accessKey}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(i.expires ?? 600),
    'X-Amz-SignedHeaders': names.join(';'),
  };
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const path = encPath(i.path);
  const canonicalRequest = [i.method, path, canonicalQuery, canonicalHeaders, names.join(';'), 'UNSIGNED-PAYLOAD'].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonicalRequest)].join('\n');
  const key = hmac(hmac(hmac(hmac(`AWS4${i.secret}`, day), i.region), service), 'aws4_request');
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  return `https://${i.host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function sign(env: R2Env, method: 'GET' | 'PUT' | 'DELETE', key: string, extra: Partial<SignInput> = {}): string {
  return signUrl({
    host: `${env.account}.r2.cloudflarestorage.com`,
    path: key ? `/${env.bucket}/${key}` : `/${env.bucket}`,
    method,
    accessKey: env.accessKey,
    secret: env.secret,
    region: 'auto',
    ...extra,
  });
}

/** One-time upload link (valid 10 minutes). The browser must send exactly these headers. */
export function uploadTarget(env: R2Env, key: string, contentType: string): { url: string; headers: Record<string, string> } {
  const headers = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' };
  return { url: sign(env, 'PUT', key, { headers, expires: 600 }), headers };
}

export async function deleteObject(env: R2Env, key: string): Promise<void> {
  const res = await fetch(sign(env, 'DELETE', key, { expires: 60 }), { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`);
}

/** Every object key that starts with the prefix (up to a few thousand; enough for one person's files). */
export async function listKeys(env: R2Env, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token = '';
  for (let page = 0; page < 10; page += 1) {
    const query: Record<string, string> = { 'list-type': '2', prefix };
    if (token) query['continuation-token'] = token;
    const res = await fetch(sign(env, 'GET', '', { query, expires: 60 }));
    if (!res.ok) throw new Error(`R2 list failed (${res.status})`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    const next = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
    if (!next) break;
    token = next[1];
  }
  return keys;
}
