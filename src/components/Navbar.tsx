import { useEffect, useState, type FormEvent } from 'react';
import { LogIn, Menu, Search } from 'lucide-react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { GROUPS, groupName, groupOf, groupTarget, rememberTab } from '../lib/nav';
import { useToast } from '../state/Toast';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import type { Key } from '../lib/i18n';
import { Avatar } from './ui';
import { MenuDrawer } from './MenuDrawer';
import { LanguageSwitch } from './LanguageSwitch';
import type { Lang } from '../lib/types';
import { NotificationBell } from './NotificationBell';

const BOTTOM = ['explore', 'arena', 'create', 'connect'];

export function Navbar() {
  const { user, profile, openAuth, updateProfile } = useAuth();
  const [menu, setMenu] = useState(false);
  const { t, lang } = useI18n();
  const { route, go } = useRouter();
  const active = groupOf(route.tab)?.id;
  useEffect(() => { rememberTab(route.tab); }, [route.tab]);
  const [q, setQ] = useState('');
  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    try { sessionStorage.setItem('kezzo-q', v); } catch { /* ignore */ }
    if (route.tab === 'search') window.dispatchEvent(new CustomEvent('kezzo-search', { detail: v }));
    else go('search');
  };
  const saveLang = (next: Lang) => {
    if (profile) updateProfile({ language: next }).catch(() => undefined);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <button type="button" onClick={() => go('search')} className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-white">
            <img src="/logo-white.svg" alt="" width="20" height="28" className="h-7 w-auto" decoding="async" />
            Kezzo
          </button>
          <nav className="hidden items-center gap-5 text-sm font-medium text-white lg:flex" aria-label="Main">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => go(groupTarget(g))}
                aria-current={active === g.id ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 py-1 text-white transition hover:opacity-80 ${active === g.id ? 'border-accent font-semibold' : 'border-transparent'}`}
              >
                {groupName(g, lang, t)}
              </button>
            ))}
          </nav>
          <form onSubmit={runSearch} role="search" className="relative hidden min-w-0 max-w-xs flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_placeholder')} aria-label={t('nav_search')}
              className="h-9 w-full rounded-full border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none" />
          </form>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" className="rounded-full border border-zinc-600 p-2 text-white hover:bg-zinc-800 sm:hidden" aria-label={t('nav_search')} onClick={() => go('search')}>
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <LanguageSwitch className="btn btn-sm border border-zinc-600 bg-transparent text-white hover:bg-zinc-800" onPick={saveLang} />
            {user && profile && <NotificationBell />}
            <button type="button" className="flex items-center gap-1.5 rounded-full border border-zinc-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800" onClick={() => setMenu(true)} aria-haspopup="dialog">
              <Menu className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('nav_menu')}</span>
              <span className="sr-only sm:hidden">{t('nav_menu')}</span>
            </button>
            {user && profile ? (
              <button type="button" onClick={() => go('profile')} aria-label={t('nav_profile')} className="hidden sm:block">
                <Avatar p={profile} size={30} />
              </button>
            ) : (
              <button type="button" className="btn btn-sm bg-white text-black hover:bg-zinc-200" onClick={() => openAuth()}>
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                {t('sign_in')}
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-800 bg-black lg:hidden" aria-label="Main">
        {GROUPS.filter((g) => BOTTOM.includes(g.id)).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => go(groupTarget(g))}
            aria-label={groupName(g, lang, t)}
            aria-current={active === g.id ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 border-t-2 py-1.5 text-[10px] text-white ${active === g.id ? 'border-accent' : 'border-transparent'}`}
          >
            <g.icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate px-0.5">{groupName(g, lang, t)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label={t('nav_menu')}
          className={`flex flex-col items-center gap-0.5 border-t-2 py-1.5 text-[10px] text-white ${active === 'community' || active === 'profile' ? 'border-accent' : 'border-transparent'}`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="max-w-full truncate px-0.5">{t('nav_menu')}</span>
        </button>
      </nav>
      <MenuDrawer open={menu} onClose={() => setMenu(false)} />
    </>
  );
}
