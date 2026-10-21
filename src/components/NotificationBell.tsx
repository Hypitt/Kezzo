import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bell, CalendarDays, CheckCheck, FileText, Heart, MessageCircle, Radio, Swords, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { describe, useNotifications, type AppNotification, type NotificationKind } from '../state/Notifications';
import { useI18n } from '../state/I18n';
import { useRouter } from '../state/Router';
import { timeAgo } from '../lib/format';
import { Avatar } from './ui';

const ICON: Record<NotificationKind, LucideIcon> = { message: MessageCircle, like: Heart, follow: UserPlus, live: Radio, battle: Swords, post: FileText, event: CalendarDays, poll: BarChart3, group: Users };

/** Bell with an unread counter in the top bar. Opens the list of notifications. */
export function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { t, lang } = useI18n();
  const { go } = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<string[]>([]);

  // What was on screen when the list was opened counts as viewed once it is closed, and then disappears.
  useEffect(() => {
    if (open) { seen.current = items.map((n) => n.id); return; }
    if (seen.current.length) { void markRead(seen.current); seen.current = []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    void markRead([n.id]);
    setOpen(false);
    switch (n.kind) {
      case 'message': return go('messages', n.actor.id);
      case 'like': return go('profile');
      case 'follow': return go('profile', n.actor.id);
      case 'live': return n.ref_id ? go('live', n.ref_id) : go('live');
      case 'battle': return n.ref_id ? go('battles', n.ref_id) : go('battles');
      case 'post': return n.count === 1 && n.ref_id ? go('post', n.ref_id) : go('profile', n.actor.id);
      case 'event': return n.ref_id ? go('community', n.ref_id) : go('community');
      case 'group': return n.ref_id ? go('groups', n.ref_id) : go('groups');
      case 'poll': return n.ref_id ? go('community', n.ref_id) : go('community');
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600 text-white hover:bg-zinc-800"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `${t('notif_title')}: ${t('notif_unread', { n: unread })}` : t('notif_title')}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-14 z-50 max-h-[70vh] overflow-hidden rounded-2xl border border-zinc-200 bg-white text-zinc-900 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-10 sm:w-96">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold">{t('notif_title')}</h2>
            {unread > 0 && (
              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900" onClick={() => void markAllRead()}>
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />{t('notif_mark_all')}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-500">{t('notif_empty')}</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.kind];
                return (
                  <li key={n.id}>
                    <button type="button" className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 ${n.read_at ? '' : 'bg-zinc-50'}`} onClick={() => openItem(n)}>
                      <span className="relative shrink-0">
                        <Avatar p={n.actor} size={36} />
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-white"><Icon className="h-2.5 w-2.5" aria-hidden="true" /></span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read_at ? 'text-zinc-700' : 'font-medium text-zinc-900'}`}>{describe(n, t)}</span>
                        <span className="block text-xs text-zinc-500">{timeAgo(n.created_at, lang)}</span>
                      </span>
                      {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
