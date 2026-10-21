import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { PublicProfile } from '../lib/types';
import { useAuth } from './Auth';
import { useI18n } from './I18n';
import { useToast } from './Toast';

export type NotificationKind = 'message' | 'like' | 'follow' | 'live' | 'battle' | 'post' | 'event' | 'poll' | 'group';
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  ref_id: string | null;
  count: number;
  created_at: string;
  read_at: string | null;
  actor: PublicProfile;
}

interface Value {
  items: AppNotification[];
  unread: number;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}
const Ctx = createContext<Value | null>(null);

const SELECT = 'id,kind,ref_id,count,created_at,read_at,actor:profiles!actor_id(id,handle,display_name,avatar_url)';

/** Loads the signed-in person's notifications and keeps them current in real time. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const newest = useRef<string | null>(null); // timestamp of the newest notification already shown
  const tRef = useRef(t);
  tRef.current = t;
  const uid = user?.id;

  const load = useCallback(async (announce: boolean) => {
    if (!uid) return;
    const { data } = await supabase.from('notifications').select(SELECT).eq('user_id', uid).order('created_at', { ascending: false }).limit(10);
    const rows = ((data ?? []) as unknown as AppNotification[]).filter((n) => n.actor);
    setItems(rows);
    const fresh = rows.filter((n) => !n.read_at && (!newest.current || n.created_at > newest.current));
    if (announce && fresh.length > 0) toast(describe(fresh[0], tRef.current));
    if (rows[0] && (!newest.current || rows[0].created_at > newest.current)) newest.current = rows[0].created_at;
  }, [uid, toast]);

  useEffect(() => {
    newest.current = null;
    setItems([]);
    if (!uid) return;
    void supabase.rpc('prune_notifications').then(() => load(false), () => load(false));
    let timer: number | undefined;
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void load(true), 400);
      })
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [uid, load]);

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    // Viewed notifications disappear (the database deletes them too)
    setItems((list) => list.filter((n) => !ids.includes(n.id)));
    await supabase.rpc('mark_notifications_read', { p_ids: ids });
  }, []);

  const markAllRead = useCallback(async () => {
    setItems([]);
    await supabase.rpc('mark_notifications_read');
  }, []);

  const unread = useMemo(() => items.filter((n) => !n.read_at).length, [items]);
  const value = useMemo(() => ({ items, unread, markRead, markAllRead }), [items, unread, markRead, markAllRead]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}

/** The sentence shown for a notification. */
export function describe(n: AppNotification, t: ReturnType<typeof useI18n>['t']): string {
  const name = n.actor.display_name;
  switch (n.kind) {
    case 'message': return n.count > 1 ? t('notif_messages', { name, n: n.count }) : t('notif_message', { name });
    case 'like': return t('notif_like', { name });
    case 'follow': return t('notif_follow', { name });
    case 'live': return t('notif_live', { name });
    case 'battle': return t('notif_battle', { name });
    case 'post': return n.count > 1 ? t('notif_posts', { name, n: n.count }) : t('notif_post', { name });
    case 'event': return n.count > 1 ? t('notif_events', { name, n: n.count }) : t('notif_event', { name });
    case 'group': return n.count > 1 ? t('notif_groups', { name, n: n.count }) : t('notif_group', { name });
    case 'poll': return n.count > 1 ? t('notif_polls', { name, n: n.count }) : t('notif_poll', { name });
  }
}
