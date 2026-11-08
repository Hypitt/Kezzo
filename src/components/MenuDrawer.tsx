import { useEffect, useState } from 'react';
import { LogOut, Settings, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { supabase } from '../lib/supabase';
import { GROUPS, TAB_ICON, groupName, groupOf, tabName } from '../lib/nav';
import { LanguageSwitch } from './LanguageSwitch';
import { InstallButton } from './InstallButton';
import { Avatar } from './ui';
import type { Lang } from '../lib/types';

/** The full menu: every page grouped by purpose, plus account actions. Opens from the Menu button on every screen size. */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile, signOut, updateProfile, openAuth } = useAuth();
  const { t, lang } = useI18n();
  const { route, go } = useRouter();
  const [admin, setAdmin] = useState(false);
  const uid = user?.id;

  useEffect(() => {
    if (!uid) { setAdmin(false); return; }
    void supabase.rpc('is_admin').then(({ data }) => setAdmin(data === true));
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Close whenever the page changes.
  useEffect(() => { onClose(); }, [route.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const active = groupOf(route.tab)?.id;
  const open_ = (tab: Parameters<typeof go>[0]) => { go(tab); onClose(); };

  const Row = ({ tab, Icon, current }: { tab: Parameters<typeof go>[0]; Icon?: LucideIcon; current: boolean }) => (
    <button
      type="button"
      onClick={() => open_(tab)}
      aria-current={current ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${current ? 'bg-zinc-100 font-semibold text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'}`}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : <span className="h-4 w-4 shrink-0" />}
      {tabName(tab, lang, t)}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('nav_menu')}>
      <button type="button" className="absolute inset-0 bg-black/50" aria-label={t('close')} onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white shadow-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 px-4">
          <span className="font-display text-base font-bold text-zinc-900">{t('nav_menu')}</span>
          <button type="button" className="rounded-full p-2 text-zinc-700 hover:bg-zinc-100" aria-label={t('close')} onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {user && profile ? (
            <button type="button" onClick={() => open_('profile')} className="mb-3 flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50">
              <Avatar p={profile} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-zinc-900">{profile.display_name || profile.handle}</span>
                <span className="block truncate text-xs text-zinc-500">@{profile.handle}</span>
              </span>
            </button>
          ) : (
            <button type="button" className="btn btn-primary mb-3 w-full" onClick={() => { onClose(); openAuth(); }}>{t('sign_in')}</button>
          )}

          {GROUPS.filter((g) => g.id !== 'profile').map((g) => (
            <section key={g.id} className="mb-3">
              {g.tabs.length > 1 ? (
                <>
                  <h2 className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{groupName(g, lang, t)}</h2>
                  {g.tabs.map((tab) => <Row key={tab} tab={tab} Icon={TAB_ICON[tab]} current={route.tab === tab} />)}
                </>
              ) : (
                g.tabs.map((tab) => <Row key={tab} tab={tab} Icon={g.icon} current={active === g.id} />)
              )}
            </section>
          ))}
        </div>

        <div className="shrink-0 space-y-2 border-t border-zinc-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <LanguageSwitch
              className="btn btn-sm border border-zinc-300 bg-white text-zinc-800"
              onPick={(l: Lang) => { if (profile) updateProfile({ language: l }).catch(() => undefined); }}
            />
            {user && profile && <InstallButton compact className="btn btn-sm border border-zinc-300 bg-white text-zinc-800" />}
          </div>
          {user && profile && (
            <div className="flex items-center gap-2">
              {admin && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => open_('admin')}>
                  <Settings className="h-4 w-4" aria-hidden="true" />Admin
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { onClose(); void signOut(); }}>
                <LogOut className="h-4 w-4" aria-hidden="true" />{t('sign_out')}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
