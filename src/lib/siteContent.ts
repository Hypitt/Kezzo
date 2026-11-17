import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { api } from './api';
import type { Lang } from './types';

/** What an admin changed on the public landing page. Anything not changed keeps the built-in text and picture. */
export interface SiteContent {
  texts: Partial<Record<Lang, Record<string, string>>>;
  images: Record<string, string>;
  video: { url?: string; poster?: string };
  order: string[];
  /** Picture slots an admin deleted without replacing them. */
  hidden: string[];
  /** Texts that were translated by the machine from another language: which paths, per language. */
  auto: Partial<Record<Lang, string[]>>;
  /** What the admin really wrote, by path, so visitors can read the original. */
  originals: Record<string, { lang: Lang; text: string }>;
}
export const EMPTY_CONTENT: SiteContent = { texts: {}, images: {}, video: {}, order: [], hidden: [], auto: {}, originals: {} };
/** Default top-to-bottom order of the sections under the top banner. */
export const DEFAULT_ORDER = ['tagline', 'video', 'contest', 'media', 'groups', 'about', 'modes', 'join', 'cta'] as const;
/** Pictures an admin can replace. */
export const IMAGE_SLOTS = ['hero', 'feed'] as const;

const KEY = 'kezzo_site_content';
const norm = (d: unknown): SiteContent => {
  const o = (d && typeof d === 'object' ? d : {}) as Partial<SiteContent>;
  return { texts: o.texts ?? {}, images: o.images ?? {}, video: o.video ?? {}, order: Array.isArray(o.order) ? o.order : [], hidden: Array.isArray(o.hidden) ? o.hidden : [], auto: o.auto ?? {}, originals: o.originals ?? {} };
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

// "Show original": visitors can read the admin's own words instead of the machine translation.
let showOrig = false;
const origListeners = new Set<(v: boolean) => void>();
export const setShowOriginal = (v: boolean): void => { showOrig = v; origListeners.forEach((l) => l(v)); };
export function useShowOriginal(): boolean {
  const [v, setV] = useState(showOrig);
  useEffect(() => { origListeners.add(setV); return () => { origListeners.delete(setV); }; }, []);
  return v;
}
/** Paths whose text on this language is a machine translation. */
export const autoPaths = (c: SiteContent, lang: Lang): string[] => c.auto[lang] ?? [];

export function useCopy<T>(base: T, lang: Lang): T {
  const c = useSiteContent();
  const orig = useShowOriginal();
  return useMemo(() => {
    const texts = { ...(c.texts[lang] ?? {}) };
    if (orig) for (const p of autoPaths(c, lang)) if (c.originals[p]) texts[p] = c.originals[p].text;
    return applyTexts(base, texts);
  }, [base, c, lang, orig]);
}

/** Section ids in display order: the admin's order first, then any section it does not mention, in the default order. */
export function orderOf(saved: string[]): string[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const out = saved.filter((x) => known.has(x));
  for (const d of DEFAULT_ORDER) if (!out.includes(d)) out.push(d);
  return out;
}

const ALL: Lang[] = ['en', 'fr', 'es', 'pt', 'hi'];

/**
 * Fills in the other languages for every text an admin wrote by hand. The admin writes once, in any language;
 * the other four are translated by the server (and cached) and marked as automatic, so visitors can still read the original.
 * A text the admin wrote by hand in a language is never replaced. Throws if the translation service is not available.
 */
export async function withTranslations(c: SiteContent): Promise<SiteContent> {
  const texts: Record<string, Record<string, string>> = {};
  const auto: Record<string, Set<string>> = {};
  for (const l of ALL) { texts[l] = { ...(c.texts[l] ?? {}) }; auto[l] = new Set(c.auto[l] ?? []); }
  const originals: SiteContent['originals'] = {};
  const paths = new Set<string>();
  for (const l of ALL) for (const p of Object.keys(texts[l])) paths.add(p);

  const todo: Record<string, { p: string; t: string; s: Lang }[]> = {};
  for (const p of paths) {
    const manual = ALL.filter((l) => texts[l][p] !== undefined && !auto[l].has(p));
    if (manual.length === 0) { for (const l of ALL) { delete texts[l][p]; auto[l].delete(p); } continue; }
    // Deleting a text in one language deletes it in every language.
    if (manual.some((l) => texts[l][p] === '')) {
      for (const l of ALL) { texts[l][p] = ''; if (!manual.includes(l)) auto[l].add(p); }
      originals[p] = { lang: manual.find((l) => texts[l][p] === '') as Lang, text: '' };
      continue;
    }
    const prev = c.originals[p];
    const src = (prev && manual.includes(prev.lang) && texts[prev.lang][p] === prev.text ? prev.lang : manual[0]) as Lang;
    const text = texts[src][p];
    originals[p] = { lang: src, text };
    for (const l of ALL) {
      if (manual.includes(l)) continue;
      if (text.trim() === '') { texts[l][p] = ''; auto[l].add(p); continue; }
      const fresh = prev && prev.lang === src && prev.text === text && auto[l].has(p) && texts[l][p] !== undefined;
      if (!fresh) (todo[l] ??= []).push({ p, t: text, s: src });
    }
  }
  for (const [l, items] of Object.entries(todo)) {
    for (let i = 0; i < items.length; i += 20) {
      const group = items.slice(i, i + 20);
      const res = await api<{ out: string[] }>('translate', { action: 'text', target: l, items: group.map((g) => ({ t: g.t, s: g.s })) });
      group.forEach((g, k) => { texts[l][g.p] = res.out[k] || g.t; auto[l].add(g.p); });
    }
  }
  const outTexts: SiteContent['texts'] = {};
  const outAuto: SiteContent['auto'] = {};
  for (const l of ALL) {
    if (Object.keys(texts[l]).length) outTexts[l] = texts[l];
    if (auto[l].size) outAuto[l] = [...auto[l]];
  }
  return { ...c, texts: outTexts, auto: outAuto, originals };
}
