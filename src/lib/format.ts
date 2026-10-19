import type { Lang } from './types';

const UNITS: [number, Intl.RelativeTimeFormatUnit, number][] = [
  [60, 'second', 1],
  [3600, 'minute', 60],
  [86400, 'hour', 3600],
  [2592000, 'day', 86400],
  [31536000, 'month', 2592000],
  [Infinity, 'year', 31536000],
];

export function timeAgo(iso: string, lang: Lang): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (seconds < 10) return rtf.format(0, 'second');
  for (const [limit, unit, div] of UNITS) {
    if (seconds < limit) return rtf.format(-Math.floor(seconds / div), unit);
  }
  return '';
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function fileExt(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  return ext.slice(0, 5) || 'bin';
}

export function isActiveStatus(p: { status_text: string | null; status_image_url?: string | null; status_expires_at: string | null }): boolean {
  return Boolean((p.status_text || p.status_image_url) && p.status_expires_at && new Date(p.status_expires_at).getTime() > Date.now());
}
