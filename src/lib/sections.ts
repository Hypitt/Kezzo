import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Sections an admin can switch on or off. The first group is the public landing page, the second is Home after sign-in. */
export const LANDING_SECTIONS = ['tagline', 'contest', 'media', 'groups', 'about', 'modes', 'join', 'cta'] as const;
export const HOME_SECTIONS = ['contest', 'statuses', 'live', 'latest'] as const;
export type Area = 'landing' | 'home';
export type Switches = Record<string, boolean>;
export interface Sections { landing: Switches; home: Switches }

const KEY = 'kezzo_sections';
const read = (): Sections => {
  try { const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Sections>; return { landing: s.landing ?? {}, home: s.home ?? {} }; } catch { return { landing: {}, home: {} }; }
};

let current: Sections = read();
let fetched = false;
const listeners = new Set<(s: Sections) => void>();

export async function loadSections(force = false): Promise<Sections> {
  if (fetched && !force) return current;
  const { data, error } = await supabase.rpc('site_sections');
  if (!error && data && typeof data === 'object') {
    const d = data as Partial<Sections>;
    current = { landing: d.landing ?? {}, home: d.home ?? {} };
    fetched = true;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l(current));
  }
  return current;
}

/** `on('media')` is true unless an admin switched that section off. The last known choice is remembered so pages do not flash. */
export function useSections(area: Area): (id: string) => boolean {
  const [s, setS] = useState<Sections>(current);
  useEffect(() => {
    listeners.add(setS);
    void loadSections();
    return () => { listeners.delete(setS); };
  }, []);
  return (id) => s[area][id] !== false;
}
