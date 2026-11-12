import { supabase } from '../../lib/supabase';

/** One person in a match room. */
export interface Member { uid: string; name: string; avatar: string | null; team: 0 | 1; host: boolean; t: number; gk?: boolean }
export interface RoomInfo { n: number; minutes: number; playing: boolean }
export type MemberRow = Member & { info?: RoomInfo };
export interface RosterEntry { rid: number; uid: string; name: string; team: 0 | 1; gk?: boolean }

export interface Room {
  send: (event: string, payload: unknown) => void;
  setMe: (patch: Partial<MemberRow>) => void;
  close: () => void;
}

const EVENTS = ['ros', 'in', 'snap', 'bye'];
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = (): string => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export const cleanCode = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

/** Joins (or opens) a match room. Everything runs through Supabase Realtime: no database tables are used. */
export function openRoom(code: string, me: MemberRow, h: { members: (list: MemberRow[]) => void; event: (name: string, payload: unknown) => void; state: (ok: boolean) => void }): Room {
  const channel = supabase.channel(`football-room:${code}`, { config: { broadcast: { self: false }, presence: { key: me.uid } } });
  let current: MemberRow = { ...me };
  let ready = false;
  for (const ev of EVENTS) channel.on('broadcast', { event: ev }, (msg: { payload: unknown }) => h.event(ev, msg.payload));
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, MemberRow[]>;
    const list = Object.values(state).map((v) => v[0]).filter((v): v is MemberRow => Boolean(v && v.uid));
    list.sort((a, b) => (a.host === b.host ? a.t - b.t : a.host ? -1 : 1));
    h.members(list);
  });
  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') { ready = true; h.state(true); void channel.track(current); }
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') h.state(false);
  });
  return {
    send: (event, payload) => { if (ready) void channel.send({ type: 'broadcast', event, payload }); },
    setMe: (patch) => { current = { ...current, ...patch }; if (ready) void channel.track(current); },
    close: () => { void supabase.removeChannel(channel); },
  };
}

/** A match that is open for anyone to join. */
export interface LobbyRow { code: string; host: string; avatar: string | null; n: number; minutes: number; humans: number; playing: boolean; t: number }

/** The list of open matches. Hosts advertise their match here; everyone else just watches the list. */
export function openLobby(uid: string, onList: (rows: LobbyRow[]) => void): { advertise: (row: LobbyRow | null) => void; close: () => void } {
  const channel = supabase.channel('football-lobby', { config: { presence: { key: uid } } });
  let ready = false; let pending: LobbyRow | null = null;
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState() as Record<string, Array<Partial<LobbyRow>>>;
    const rows = Object.values(state).map((v) => v[0]).filter((v): v is LobbyRow => Boolean(v && v.code));
    onList(rows.sort((a, b) => b.t - a.t));
  });
  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') { ready = true; if (pending) void channel.track(pending); }
  });
  return {
    advertise: (row) => { pending = row; if (!ready) return; if (row) void channel.track(row); else void channel.untrack(); },
    close: () => { void supabase.removeChannel(channel); },
  };
}
