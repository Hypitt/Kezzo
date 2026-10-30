import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import type { Lang } from './types';

/** What an admin changed on the public landing page. Anything not changed keeps the built-in text and picture. */
export interface SiteContent {
  texts: Partial<Record<Lang, Record<string, string>>>;
  images: Record<string, string>;
  video: { url?: string; poster?: string };
  order: string[];
  /** Picture slots an admin deleted without replacing them. */
  hidden: string[];
}
export const EMPTY_CONTENT: SiteContent = { texts: {}, images: {}, video: {}, order: [], hidden: [] };
/** Default top-to-bottom order of the sections under the top banner. */
export const DEFAULT_ORDER = ['tagline', 'video', 'contest', 'media', 'groups', 'about', 'modes', 'join', 'cta'] as const;
/** Pictures an admin can replace. */
export const IMAGE_SLOTS = ['hero', 'feed'] as const;

const KEY = 'kezzo_site_content';
const norm = (d: unknown): SiteContent => {
  const o = (d && typeof d === 'object' ? d : {}) as Partial<SiteContent>;
  return { texts: o.texts ?? {}, images: o.images ?? {}, video: o.video ?? {}, order: Array.isArray(o.order) ? o.order : [], hidden: Array.isArray(o.hidden) ? o.hidden : [] };
};
const read = (): SiteContent => { try { return norm(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return EMPTY_CONTENT; } };

let current: SiteContent = read();
let fetched = false;
const listeners = new Set<(c: SiteContent) => void>();

export async function loadContent(force = false): Promise<SiteContent> {
  if (fetched && !force) return current;
  const { data, error } = await supabase.rpc('site_content');
  if (!error && data) {
    current = norm(data);
    fetched = true;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l(current));
  }
  return current;
}

export function useSiteContent(): SiteContent {
  const [c, setC] = useState(current);
  useEffect(() => { listeners.add(setC); void loadContent(); return () => { listeners.delete(setC); }; }, []);
  return c;
}

/** Every plain-text value of a copy object, keyed by path ("h1a", "lines.0", "pillars.1.2"). Functions are skipped. */
export function flatten(v: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (typeof v === 'string') { if (prefix) out[prefix] = v; }
  else if (Array.isArray(v)) v.forEach((x, i) => flatten(x, prefix ? `${prefix}.${i}` : String(i), out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flatten(x, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/** A copy of `base` with the admin's texts put in. Same shape, so the page code does not change. */
export function applyTexts<T>(base: T, over: Record<string, string> | undefined): T {
  if (!over || Object.keys(over).length === 0) return base;
  const walk = (v: unknown, prefix: string): unknown => {
    if (typeof v === 'string') return prefix && over[prefix] !== undefined ? over[prefix] : v; // an empty text means the admin deleted it
    if (Array.isArray(v)) return v.map((x, i) => walk(x, prefix ? `${prefix}.${i}` : String(i)));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, prefix ? `${prefix}.${k}` : k)]));
    return v;
  };
  return walk(base, '') as T;
}

export function useCopy<T>(base: T, lang: Lang): T {
  const c = useSiteContent();
  return useMemo(() => applyTexts(base, c.texts[lang]), [base, c.texts, lang]);
}

/** Section ids in display order: the admin's order first, then any section it does not mention, in the default order. */
export function orderOf(saved: string[]): string[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const out = saved.filter((x) => known.has(x));
  for (const d of DEFAULT_ORDER) if (!out.includes(d)) out.push(d);
  return out;
}
