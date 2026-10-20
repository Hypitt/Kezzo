import { Coins, Home, Image as ImageIcon, Languages, LogIn, MessageCircle, PlusCircle, Radio, Search, Swords, User, Users, type LucideIcon } from 'lucide-react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter, type Tab } from '../state/Router';
import { useToast } from '../state/Toast';
import { supabase } from '../lib/supabase';
import { explain } from '../lib/errors';
import type { Key } from '../lib/i18n';
import { Avatar } from './ui';
import { NotificationBell } from './NotificationBell';

const NAV: { tab: Exclude<Tab, 'legal'>; icon: LucideIcon; label: Key }[] = [
  { tab: 'home', icon: Home, label: 'nav_home' },
  { tab: 'battles', icon: Swords, label: 'nav_battles' },
  { tab: 'live', icon: Radio, label: 'nav_live' },
  { tab: 'search', icon: Search, label: 'nav_search' },
  { tab: 'create', icon: PlusCircle, label: 'nav_create' },
  { tab: 'media', icon: ImageIcon, label: 'nav_media' },
  { tab: 'groups', icon: Users, label: 'nav_groups' },
  { tab: 'messages', icon: MessageCircle, label: 'nav_messages' },
  { tab: 'profile', icon: User, label: 'nav_profile' },
];

export function Navbar() {
  const { user, profile, wallet, openAuth, updateProfile, refreshWallet } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { route, go } = useRouter();
  const { toast } = useToast();

  const thisMonth = new Date().toISOString().slice(0, 7);
  const canClaim = Boolean(wallet && wallet.last_claim_month.slice(0, 7) < thisMonth);

  const claim = async () => {
    const { error } = await supabase.rpc('claim_monthly_coins');
    if (error) return toast(explain(error, t), 'error');
    await refreshWallet();
    toast(t('claimed_toast'));
  };

  const switchLang = () => {
    const next = lang === 'en' ? 'fr' : 'en';
    setLang(next);
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
          <nav className="hidden items-center gap-4 text-sm font-medium text-white lg:flex" aria-label="Main">
            {NAV.map(({ tab, label }) => (
              <button
                key={tab}
                type="button"
                onClick={() => go(tab)}
                aria-current={route.tab === tab ? 'page' : undefined}
                className={`whitespace-nowrap border-b-2 py-1 text-white transition hover:opacity-80 ${route.tab === tab ? 'border-accent font-semibold' : 'border-transparent'}`}
              >
                {t(label)}
              </button>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {wallet && (
              <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-1 text-xs font-medium text-white" title={t('coins_title')}>
                <Coins className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                <span className="tabular-nums">{wallet.voting_coins}</span>
                {canClaim && (
                  <button type="button" className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-white" onClick={claim}>
                    {t('claim_coins')}
                  </button>
                )}
              </div>
            )}
            {user && profile && <NotificationBell />}
            <button type="button" className="btn btn-sm border border-zinc-600 bg-transparent text-white hover:bg-zinc-800" onClick={switchLang} aria-label={t('language')}>
              <Languages className="h-3.5 w-3.5" aria-hidden="true" />
              {lang.toUpperCase()}
            </button>
            {user && profile ? (
              <button type="button" onClick={() => go('profile')} aria-label={t('nav_profile')}>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-9 border-t border-zinc-800 bg-black lg:hidden" aria-label="Main">
        {NAV.map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            type="button"
            onClick={() => go(tab)}
            aria-label={t(label)}
            aria-current={route.tab === tab ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 border-t-2 py-2 text-[10px] text-white ${route.tab === tab ? 'border-accent' : 'border-transparent'}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </button>
        ))}
      </nav>
    </>
  );
}
