import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PUBLIC_PROFILE } from '../lib/data';
import { startRingtone, stopRingtone, unlockAudio } from '../lib/ringtone';
import type { PublicProfile } from '../lib/types';
import { Avatar } from '../components/ui';
import { CallDock } from '../components/CallDock';
import { useAuth } from './Auth';
import { useI18n } from './I18n';
import { useToast } from './Toast';

/** How long a call rings before it counts as missed. */
const RING_SECONDS = 45;

export type CallKind = 'dm' | 'group';
interface Invite {
  id: string;
  caller_id: string;
  kind: CallKind;
  group_id: string | null;
  video: boolean;
  caller: PublicProfile;
  groupName: string | null;
}
/** The call the person is in right now. It lives here (above every page), so browsing Kezzo never cuts it. */
export interface ActiveCall { kind: CallKind; target: string; video: boolean; label: string; key: number }

interface Value {
  /** The running call, shown in a floating window that stays while the person uses the rest of the app. */
  active: ActiveCall | null;
  /** Starts a call (rings the other person or the group's members) and opens the floating call window. */
  startCall: (kind: CallKind, target: string, video: boolean, label: string) => void;
  /** Leaves the call; stops the ringing if nobody answered yet. */
  endCall: () => void;
}
const Ctx = createContext<Value | null>(null);

interface InviteRow { id: string; caller_id: string; kind: CallKind; group_id: string | null; video: boolean; status: string; created_at: string }

/** Listens for incoming calls (direct and group), rings, and shows the Accept / Decline screen. */
export function CallsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const uid = user?.id;
  const [queue, setQueue] = useState<Invite[]>([]);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const activeRef = useRef<ActiveCall | null>(null);
  activeRef.current = active;
  const tRef = useRef(t);
  tRef.current = t;
  const current = queue[0] ?? null;

  useEffect(() => { unlockAudio(); }, []);

  const hydrate = useCallback(async (row: InviteRow): Promise<Invite | null> => {
    const { data: caller } = await supabase.from('profiles').select(PUBLIC_PROFILE).eq('id', row.caller_id).maybeSingle();
    if (!caller) return null;
    let groupName: string | null = null;
    if (row.kind === 'group' && row.group_id) {
      const { data: g } = await supabase.from('groups').select('name').eq('id', row.group_id).maybeSingle();
      groupName = (g as { name: string } | null)?.name ?? null;
    }
    return { id: row.id, caller_id: row.caller_id, kind: row.kind, group_id: row.group_id, video: row.video, caller: caller as PublicProfile, groupName };
  }, []);

  const add = useCallback(async (row: InviteRow) => {
    if (row.status !== 'ringing') return;
    const invite = await hydrate(row);
    if (!invite) return;
    setQueue((q) => (q.some((x) => x.id === invite.id) ? q : [...q, invite]));
  }, [hydrate]);

  // Listen for calls to me, and for answers to calls I made.
  useEffect(() => {
    setQueue([]);
    if (!uid) return;
    let off = false;
    void (async () => {
      const since = new Date(Date.now() - RING_SECONDS * 1000).toISOString();
      const { data } = await supabase.from('call_invites')
        .select('id,caller_id,kind,group_id,video,status,created_at').eq('recipient_id', uid).eq('status', 'ringing').gt('created_at', since);
      if (off) return;
      for (const row of (data ?? []) as InviteRow[]) await add(row);
    })();
    const channel = supabase.channel(`calls:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_invites', filter: `recipient_id=eq.${uid}` }, (payload) => void add(payload.new as InviteRow))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_invites', filter: `recipient_id=eq.${uid}` }, (payload) => {
        const row = payload.new as InviteRow;
        // Cancelled by the caller, or answered on my other device: stop ringing here.
        if (row.status !== 'ringing') setQueue((q) => q.filter((x) => x.id !== row.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_invites', filter: `caller_id=eq.${uid}` }, (payload) => {
        const row = payload.new as InviteRow;
        if (row.status !== 'declined') return;
        const recipient = (payload.new as { recipient_id: string }).recipient_id;
        void (async () => {
          // Is anyone still ringing or in the call? If not, the call is over for the caller.
          let q = supabase.from('call_invites').select('id', { count: 'exact', head: true })
            .eq('caller_id', uid).in('status', ['ringing', 'accepted']).gt('created_at', new Date(Date.now() - 120_000).toISOString());
          q = row.kind === 'dm' ? q.eq('kind', 'dm').eq('recipient_id', recipient) : q.eq('group_id', row.group_id ?? '');
          const { count } = await q;
          if ((count ?? 0) > 0) return;
          const target = row.kind === 'dm' ? recipient : row.group_id ?? '';
          // Everyone said no: close the call window if it is this call.
          setActive((a) => (a && a.kind === row.kind && a.target === target ? null : a));
          if (row.kind === 'group') return toast(tRef.current('call_all_declined'));
          const { data: p } = await supabase.from('profiles').select('display_name').eq('id', recipient).maybeSingle();
          toast(tRef.current('call_declined', { name: (p as { display_name: string } | null)?.display_name ?? '' }));
        })();
      })
      .subscribe();
    return () => {
      off = true;
      void supabase.removeChannel(channel);
    };
  }, [uid, add, toast]);

  // Ring while something is waiting; give up after 45 seconds (a missed call).
  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    startRingtone();
    const stopAt = window.setTimeout(() => setQueue((q) => q.filter((x) => x.id !== currentId)), RING_SECONDS * 1000);
    const title = document.title;
    let flash = true;
    const blink = window.setInterval(() => {
      document.title = flash ? `📞 ${tRef.current('incoming_call')}` : title;
      flash = !flash;
    }, 1000);
    let shown: Notification | null = null;
    try {
      if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
        shown = new Notification(tRef.current('incoming_call'), { tag: 'kezzo-call', body: tRef.current('incoming_call_body') });
        shown.onclick = () => { window.focus(); shown?.close(); };
      }
    } catch { /* not supported */ }
    return () => {
      stopRingtone();
      window.clearTimeout(stopAt);
      window.clearInterval(blink);
      document.title = title;
      shown?.close();
    };
  }, [currentId]);

  const accept = async () => {
    if (!current) return;
    const invite = current;
    setQueue((q) => q.filter((x) => x.caller_id !== invite.caller_id || x.kind !== invite.kind));
    await supabase.rpc('respond_call', { p_id: invite.id, p_accept: true });
    // Join right here: the call opens in the floating window and the person stays wherever they were.
    setActive({
      kind: invite.kind,
      target: invite.kind === 'dm' ? invite.caller_id : invite.group_id ?? '',
      video: invite.video,
      label: invite.kind === 'dm' ? invite.caller.display_name : invite.groupName ?? invite.caller.display_name,
      key: Date.now(),
    });
  };
  const decline = async () => {
    if (!current) return;
    const id = current.id;
    setQueue((q) => q.filter((x) => x.id !== id));
    await supabase.rpc('respond_call', { p_id: id, p_accept: false });
  };

  const ring = useCallback(async (kind: CallKind, target: string, video: boolean) => {
    // Let the browser show a banner when the page is in the background (asked only while the person presses Call).
    try {
      if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
    } catch { /* not supported */ }
    try { await supabase.rpc('start_call', { p_kind: kind, p_target: target, p_video: video }); } catch { /* the call itself still works */ }
  }, []);

  const hangUp = useCallback(async (kind: CallKind, target: string) => {
    try { await supabase.rpc('cancel_call', { p_kind: kind, p_target: target }); } catch { /* nothing to cancel */ }
  }, []);

  const startCall = useCallback((kind: CallKind, target: string, video: boolean, label: string) => {
    const a = activeRef.current;
    if (a && a.kind === kind && a.target === target && a.video === video) return;
    if (a) void hangUp(a.kind, a.target);
    setActive({ kind, target, video, label, key: Date.now() });
    void ring(kind, target, video);
  }, [ring, hangUp]);

  const endCall = useCallback(() => {
    const a = activeRef.current;
    setActive(null);
    if (a) void hangUp(a.kind, a.target);
  }, [hangUp]);

  // Signing out ends the call.
  useEffect(() => { if (!uid) setActive(null); }, [uid]);

  const value = useMemo(() => ({ active, startCall, endCall }), [active, startCall, endCall]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {active && uid && (
        <CallDock
          key={active.key}
          roomName={active.kind === 'dm' ? `dm:${[uid, active.target].sort().join(':')}` : `group:${active.target}`}
          video={active.video}
          label={active.label}
          onEnd={endCall}
        />
      )}
      {current && (
        <div className="fixed inset-x-0 top-0 z-[100] flex justify-center p-3 sm:p-4" role="alertdialog" aria-live="assertive" aria-label={t('incoming_call')}>
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 p-5 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center gap-4">
              <span className="relative shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" aria-hidden="true" />
                <span className="relative block"><Avatar p={current.caller} size={56} /></span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{current.caller.display_name}</p>
                <p className="flex items-center gap-1.5 text-sm text-zinc-300">
                  {current.video ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Phone className="h-3.5 w-3.5" aria-hidden="true" />}
                  {current.kind === 'group'
                    ? t(current.video ? 'incoming_group_video' : 'incoming_group_voice', { group: current.groupName ?? '' })
                    : t(current.video ? 'incoming_video' : 'incoming_voice')}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={decline} className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <PhoneOff className="h-4 w-4" aria-hidden="true" />{t('decline')}
              </button>
              <button type="button" onClick={accept} autoFocus className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <Phone className="h-4 w-4" aria-hidden="true" />{t('accept')}
              </button>
            </div>
            {queue.length > 1 && <p className="mt-3 text-center text-xs text-zinc-400">{t('more_calls', { n: queue.length - 1 })}</p>}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useCalls(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCalls must be used inside CallsProvider');
  return ctx;
}
