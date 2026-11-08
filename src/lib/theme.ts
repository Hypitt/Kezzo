import { useEffect } from 'react';
import { supabase } from './supabase';

/**
 * Look of the whole site, chosen by an admin: three colours, two fonts and the text size (one for the app, one for the landing page).
 * Anything not set keeps the built-in look. It works by changing a few CSS variables on the page, so every screen follows it.
 */
export interface Theme {
  accent: string;
  /** Dark colour used for headings, body text and dark bars. */
  ink: string;
  /** Soft background used for alternating sections and cards. */
  soft: string;
  headingFont: string;
  bodyFont: string;
  /** Text size in percent of the normal size. */
  appScale: number;
  landingScale: number;
}

export const DEFAULT_THEME: Theme = { accent: '#e5432b', ink: '#18181b', soft: '#fafaf9', headingFont: 'Sora', bodyFont: 'DM Sans', appScale: 100, landingScale: 100 };

/** Fonts an admin can pick (all free Google Fonts) with the fallback that is used while they load. */
export const FONTS: Array<{ name: string; fallback: string }> = [
  { name: 'Sora', fallback: 'sans-serif' }, { name: 'DM Sans', fallback: 'sans-serif' }, { name: 'Inter', fallback: 'sans-serif' },
  { name: 'Poppins', fallback: 'sans-serif' }, { name: 'Montserrat', fallback: 'sans-serif' }, { name: 'Nunito', fallback: 'sans-serif' },
  { name: 'Raleway', fallback: 'sans-serif' }, { name: 'Work Sans', fallback: 'sans-serif' }, { name: 'Space Grotesk', fallback: 'sans-serif' },
  { name: 'Playfair Display', fallback: 'serif' }, { name: 'Lora', fallback: 'serif' }, { name: 'Merriweather', fallback: 'serif' },
];

const KEY = 'kezzo_theme';
const HEX = /^#[0-9a-f]{6}$/i;
const clampScale = (n: unknown, d: number) => (typeof n === 'number' && n >= 85 && n <= 125 ? Math.round(n) : d);

export function normalizeTheme(raw: unknown): Theme {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const hex = (v: unknown, d: string) => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d);
  const font = (v: unknown, d: string) => (typeof v === 'string' && FONTS.some((f) => f.name === v) ? v : d);
  return {
    accent: hex(o.accent, DEFAULT_THEME.accent), ink: hex(o.ink, DEFAULT_THEME.ink), soft: hex(o.soft, DEFAULT_THEME.soft),
    headingFont: font(o.headingFont, DEFAULT_THEME.headingFont), bodyFont: font(o.bodyFont, DEFAULT_THEME.bodyFont),
    appScale: clampScale(o.appScale, 100), landingScale: clampScale(o.landingScale, 100),
  };
}

let saved: Theme = DEFAULT_THEME;
let shown: Theme = DEFAULT_THEME;
let scope: 'app' | 'landing' = 'app';

/** Adds the Google Fonts stylesheet for a font once (the two built-in fonts are already in index.html). */
function loadFont(name: string) {
  if (name === 'Sora' || name === 'DM Sans') return;
  const id = `font-${name.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

const stack = (name: string) => `"${name}", ${FONTS.find((f) => f.name === name)?.fallback === 'serif' ? 'Georgia, serif' : '"Helvetica Neue", Arial, sans-serif'}`;

/** Puts a theme on the page. Only values that differ from the built-in look are written, so the default stays untouched. */
export function applyTheme(t: Theme): void {
  shown = t;
  const s = document.documentElement.style;
  const set = (prop: string, value: string | null) => { if (value === null) s.removeProperty(prop); else s.setProperty(prop, value); };
  set('--color-accent', t.accent === DEFAULT_THEME.accent ? null : t.accent);
  set('--color-accent-dark', t.accent === DEFAULT_THEME.accent ? null : `color-mix(in srgb, ${t.accent} 82%, black)`);
  set('--color-zinc-900', t.ink === DEFAULT_THEME.ink ? null : t.ink);
  set('--color-stone-50', t.soft === DEFAULT_THEME.soft ? null : t.soft);
  loadFont(t.headingFont);
  loadFont(t.bodyFont);
  set('--font-display', t.headingFont === DEFAULT_THEME.headingFont ? null : stack(t.headingFont));
  set('--font-sans', t.bodyFont === DEFAULT_THEME.bodyFont ? null : stack(t.bodyFont));
  const scale = scope === 'landing' ? t.landingScale : t.appScale;
  set('font-size', scale === 100 ? null : `${scale}%`);
}

/** Called once at start-up: shows the last theme straight away, then fetches the current one. */
export function initTheme(): void {
  try { saved = normalizeTheme(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { saved = DEFAULT_THEME; }
  applyTheme(saved);
  void loadTheme();
}

export async function loadTheme(): Promise<Theme> {
  const { data, error } = await supabase.rpc('site_theme');
  if (!error && data) {
    saved = normalizeTheme(data);
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* storage unavailable */ }
    applyTheme(saved);
  }
  return saved;
}

export const currentTheme = (): Theme => saved;

export async function saveTheme(t: Theme): Promise<string | null> {
  const { error } = await supabase.rpc('admin_set_theme', { p_theme: t });
  if (error) return error.message;
  saved = t;
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* storage unavailable */ }
  applyTheme(t);
  return null;
}

/** Marks the current screen as the landing page (own text size) or the app, for as long as it is mounted. */
export function useThemeScope(next: 'app' | 'landing'): void {
  useEffect(() => {
    scope = next;
    applyTheme(shown);
    return () => { scope = 'app'; applyTheme(shown); };
  }, [next]);
}

/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
