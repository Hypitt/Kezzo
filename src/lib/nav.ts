import { Briefcase, CalendarDays, Home, MessageCircle, PlusCircle, Radio, Search, Swords, Image as ImageIcon, User, Users, Trophy, CalendarCheck, type LucideIcon } from 'lucide-react';
import type { Key } from './i18n';
import type { Lang } from './types';
import type { Tab } from '../state/Router';
import { CONTEST } from './contest';

/** The app menu groups related pages. Every page is still its own address (#/search, #/battles ...); nothing was removed. */
export interface NavGroup { id: string; icon: LucideIcon; tabs: Tab[]; name: Key | Record<Lang, string> }

export const GROUPS: NavGroup[] = [
  { id: 'explore', icon: Home, tabs: ['home', 'search', 'media'], name: { en: 'Explore', fr: 'Explorer', es: 'Explorar', pt: 'Explorar', hi: 'एक्सप्लोर' } },
  { id: 'arena', icon: Swords, tabs: ['battles', 'live', 'contest'], name: { en: 'Arena', fr: 'Arène', es: 'Arena', pt: 'Arena', hi: 'अरेना' } },
  { id: 'create', icon: PlusCircle, tabs: ['create'], name: 'nav_create' },
  { id: 'community', icon: CalendarDays, tabs: ['community', 'opportunities'], name: { en: 'Community', fr: 'Communauté', es: 'Comunidad', pt: 'Comunidade', hi: 'समुदाय' } },
  { id: 'connect', icon: Users, tabs: ['groups', 'messages'], name: { en: 'Connect', fr: 'Échanger', es: 'Conectar', pt: 'Conectar', hi: 'जुड़ें' } },
  { id: 'profile', icon: User, tabs: ['profile'], name: 'nav_profile' },
];

export const TAB_ICON: Partial<Record<Tab, LucideIcon>> = {
  home: Home, search: Search, media: ImageIcon, battles: Swords, live: Radio, contest: Trophy,
  community: CalendarCheck, opportunities: Briefcase, groups: Users, messages: MessageCircle,
};

const TAB_KEY: Partial<Record<Tab, Key>> = {
  home: 'nav_home', search: 'nav_search', media: 'nav_media', battles: 'nav_battles', live: 'nav_live',
  community: 'nav_community', opportunities: 'nav_opportunities', groups: 'nav_groups', messages: 'nav_messages',
  create: 'nav_create', profile: 'nav_profile',
};

export const groupOf = (tab: Tab): NavGroup | undefined => GROUPS.find((g) => g.tabs.includes(tab));

export function groupName(g: NavGroup, lang: Lang, t: (k: Key) => string): string {
  return typeof g.name === 'string' ? t(g.name) : g.name[lang];
}
export function tabName(tab: Tab, lang: Lang, t: (k: Key) => string): string {
  if (tab === 'contest') return CONTEST[lang].nav;
  const k = TAB_KEY[tab];
  return k ? t(k) : tab;
}

// The page a group opens when its menu item is pressed: the one the person used last in that group.
const last: Record<string, Tab> = {};
export const rememberTab = (tab: Tab): void => { const g = groupOf(tab); if (g) last[g.id] = tab; };
export const groupTarget = (g: NavGroup): Tab => last[g.id] ?? g.tabs[0];
