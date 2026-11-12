import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Gamepad2, Share2, Users, Wifi } from 'lucide-react';
import { FootballGame } from '../components/football/FootballGame';
import { cleanCode, newCode, openLobby, openRoom, type LobbyRow, type MemberRow, type Room, type RosterEntry } from '../game/football/net';
import { FOOTBALL } from '../lib/footballText';
import { copyText } from '../lib/share';
import { useAuth } from '../state/Auth';
import { useI18n } from '../state/I18n';
import { useToast } from '../state/Toast';
import { Avatar, Chip, Empty, PageHeader } from '../components/ui';

type Screen = 'menu' | 'lobby' | 'game';
const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const LENGTHS = [1, 3, 5, 10];
const field = 'input';

/** Football: 2 players on one screen, or online with a host, friends and computer players filling every team. */
export function FootballView({ code: linkCode }: { code?: string }) {
  const { user, profile, openAuth } = useAuth();
  const { lang } = useI18n();
  const { toast } = useToast();
  const w = FOOTBALL[lang];
  const teamNames: [string, string] = [w.teamA, w.teamB];

  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<'local' | 'host' | 'client'>('local');
  const [n, setN] = useState(5);
  const [minutes, setMinutes] = useState(3);
  const [code, setCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [myRid, setMyRid] = useState(-1);
  const [connected, setConnected] = useState(false);
  const [pub, setPub] = useState(true);
  const [lobbyRows, setLobbyRows] = useState<LobbyRow[]>([]);
  const [result, setResult] = useState<[number, number] | null>(null);
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [keepers, setKeepers] = useState<[boolean, boolean]>([false, false]);

  const room = useRef<Room | null>(null);
  const bus = useRef<((event: string, payload: unknown) => void) | null>(null);
  const lobby = useRef<ReturnType<typeof openLobby> | null>(null);
  const rids = useRef(new Map<string, number>());
  const sawHost = useRef(false);
  const chose = useRef(false);
  const createdAt = useRef(Date.now());
  const me = user?.id ?? '';
  const myName = profile?.display_name ?? 'Player';

  // The list of open matches (also used by a host to advertise their match)
  useEffect(() => {
    if (!user) return undefined;
    const l = openLobby(user.id, setLobbyRows);
    lobby.current = l;
    return () => { l.close(); lobby.current = null; setLobbyRows([]); };
  }, [user]);

  const leave = useCallback(() => {
    room.current?.send('bye', {});
    room.current?.close(); room.current = null;
    rids.current = new Map(); sawHost.current = false; chose.current = false;
    setMembers([]); setRoster([]); setMyRid(-1); setConnected(false); setPlaying(false); setResult(null); setCode('');
    setScreen('menu'); setMode('local');
  }, []);
  useEffect(() => () => { room.current?.close(); room.current = null; }, []);

  const enter = useCallback((asHost: boolean, roomCode: string) => {
    if (!user) { openAuth('signin'); return; }
    const first: MemberRow = { uid: user.id, name: myName, avatar: profile?.avatar_url ?? null, team: 0, host: asHost, t: Date.now(), info: asHost ? { n, minutes, playing: false } : undefined };
    createdAt.current = Date.now(); sawHost.current = asHost; chose.current = asHost;
    setCode(roomCode); setMode(asHost ? 'host' : 'client'); setScreen('lobby'); setConnected(false); setPlaying(false); setResult(null);
    room.current = openRoom(roomCode, first, {
      members: (list) => setMembers(list),
      state: (ok) => setConnected(ok),
      event: (event, payload) => {
        if (event === 'ros' && !asHost) {
          const p = payload as { playing: boolean; n: number; minutes: number; round: number; roster: RosterEntry[] };
          if (!p || !Array.isArray(p.roster)) return;
          setN(p.n); setMinutes(p.minutes); setRoster(p.roster); setMyRid(p.roster.find((r) => r.uid === user.id)?.rid ?? -1);
          setRound((r) => { if (r !== p.round) setResult(null); return p.round; });
          if (p.playing) { setPlaying(true); setScreen('game'); }
          else { setPlaying(false); setScreen((sc) => (sc === 'game' ? 'lobby' : sc)); }
        } else if (event === 'bye' && !asHost) { toast(w.hostLeft, 'error'); leave(); }
        else bus.current?.(event, payload);
      },
    });
  }, [user, myName, profile?.avatar_url, n, minutes, openAuth, toast, w.hostLeft, leave]);

  // A link like #/football/AB3XY opens that match
  const linkDone = useRef('');
  useEffect(() => {
    if (!linkCode || screen !== 'menu' || !user) return;
    const c = cleanCode(linkCode);
    if (c.length !== 5 || linkDone.current === c) return;
    linkDone.current = c;
    window.history.replaceState(null, '', '#/football');
    enter(false, c);
  }, [linkCode, user, screen, enter]);

  // Newcomers pick the smaller team; the host also notices when the host disappears
  useEffect(() => {
    if (mode !== 'client' || !members.length) return;
    const host = members.some((m) => m.host);
    if (host) sawHost.current = true;
    else if (sawHost.current && connected) { toast(w.hostLeft, 'error'); leave(); return; }
    if (!chose.current && members.some((m) => m.uid === me)) {
      chose.current = true;
      const a = members.filter((m) => m.uid !== me && m.team === 0).length; const b = members.filter((m) => m.uid !== me && m.team === 1).length;
      if (a > b) room.current?.setMe({ team: 1 });
    }
  }, [members, mode, me, connected, toast, w.hostLeft, leave]);

  const hostInfo = members.find((m) => m.host)?.info;

  // Host: who is playing, with a stable number for each person
  const currentRoster = useMemo<RosterEntry[]>(() => {
    if (mode !== 'host') return [];
    return members.map((m) => {
      let rid = rids.current.get(m.uid);
      if (rid === undefined) { rid = rids.current.size; rids.current.set(m.uid, rid); }
      return { rid, uid: m.uid, name: m.name, team: m.team, gk: m.gk === true && n >= 2 };
    });
  }, [members, mode, n]);

  useEffect(() => {
    if (mode !== 'host') return undefined;
    setRoster(currentRoster); setMyRid(currentRoster.find((r) => r.uid === me)?.rid ?? 0);
    if (!playing) return undefined;
    const send = () => room.current?.send('ros', { playing: true, n, minutes, round, roster: currentRoster });
    send();
    const id = window.setInterval(send, 2000);
    return () => window.clearInterval(id);
  }, [mode, currentRoster, playing, n, minutes, round, me]);

  // Host: keep the room and the public list up to date
  useEffect(() => {
    if (mode !== 'host') return;
    room.current?.setMe({ info: { n, minutes, playing } });
  }, [mode, n, minutes, playing, connected]);
  useEffect(() => {
    if (mode !== 'host' || !user || !connected) return undefined;
    const l = lobby.current;
    l?.advertise(pub ? { code, host: myName, avatar: profile?.avatar_url ?? null, n, minutes, humans: members.length, playing, t: createdAt.current } : null);
    return () => { l?.advertise(null); };
  }, [mode, user, connected, pub, code, myName, profile?.avatar_url, n, minutes, members.length, playing]);

  const startLocal = () => { setMode('local'); setResult(null); setRound((r) => r + 1); setScreen('game'); };
  const hostMatch = () => { if (!user) { openAuth('signin'); return; } enter(true, newCode()); };
  const joinCode = (c: string) => {
    const k = cleanCode(c);
    if (k.length !== 5) { toast(w.badCode, 'error'); return; }
    if (!user) { openAuth('signin'); return; }
    enter(false, k);
  };
  const startOnline = () => { setResult(null); setPlaying(true); setRound((r) => r + 1); setScreen('game'); };
  const playAgain = () => {
    setResult(null); setRound((r) => r + 1);
  };
  const quitGame = () => { if (mode === 'local') { setScreen('menu'); setResult(null); } else if (mode === 'host') { room.current?.send('ros', { playing: false, n, minutes, round, roster }); setPlaying(false); setResult(null); setScreen('lobby'); } else leave(); };

  const link = code ? `${window.location.origin}/#/football/${code}` : '';
  const copyInvite = async () => toast((await copyText(link)) ? w.copied : w.hostLeft, 'info');
  const shareInvite = async () => {
    if (typeof navigator.share === 'function') { try { await navigator.share({ title: 'Kezzo', text: w.inviteText, url: link }); return; } catch { /* cancelled */ } }
    await copyInvite();
  };

  // ---- the match ----
  if (screen === 'game') {
    const winnerText = result ? (result[0] === result[1] ? w.draw : w.winner(result[0] > result[1] ? w.teamA : w.teamB)) : '';
    return (
      <>
        <FootballGame key={`${mode}-${round}`} mode={mode} n={n} minutes={minutes} roster={roster} myRid={myRid} room={room.current} bus={bus}
          words={w} teamNames={teamNames} localKeepers={keepers} onQuit={quitGame} onEnd={(s) => setResult(s)} />
        {result && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-5 text-center text-zinc-900">
              <h2 className="font-display text-xl font-bold">{winnerText}</h2>
              <p className="text-3xl font-bold">{result[0]} - {result[1]}</p>
              {mode !== 'client' && <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 w-full" onClick={playAgain}>{w.playAgain}</button>}
              <button type="button" className="btn btn-ghost w-full" onClick={quitGame}>{w.back}</button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ---- the lobby of an online match ----
  if (screen === 'lobby') {
    const mine = members.find((m) => m.uid === me);
    const info = mode === 'host' ? { n, minutes } : hostInfo;
    const per = info?.n ?? n;
    const teams: Array<0 | 1> = [0, 1];
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <PageHeader title={w.lobbyTitle} sub={info ? w.matchOf(info.n, info.minutes) : w.connecting}
          action={<button type="button" className="btn btn-ghost btn-sm" onClick={leave}>{w.leave}</button>} />
        <section className="card space-y-3 text-zinc-900">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs text-zinc-500">{w.code}</p>
              <p className="font-display text-3xl font-extrabold tracking-widest">{code}</p>
            </div>
            <span className="flex-1" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copyInvite()}><Copy className="h-4 w-4" aria-hidden="true" />{w.copyLink}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void shareInvite()}><Share2 className="h-4 w-4" aria-hidden="true" />{w.share}</button>
          </div>
          {!connected && <p className="text-sm text-zinc-500">{w.connecting}</p>}
        </section>

        {mode === 'host' && (
          <section className="card space-y-3 text-zinc-900">
            <div>
              <span className="label">{w.perTeam}</span>
              <div className="flex flex-wrap gap-2">{SIZES.map((k) => <Chip key={k} active={n === k} onClick={() => setN(k)}>{k}</Chip>)}</div>
            </div>
            <div>
              <span className="label">{w.minutes}</span>
              <div className="flex flex-wrap gap-2">{LENGTHS.map((k) => <Chip key={k} active={minutes === k} onClick={() => setMinutes(k)}>{k}</Chip>)}</div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />{w.publicMatch}</label>
          </section>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => {
            const list = members.filter((m) => m.team === t);
            const full = list.length >= per;
            return (
              <section key={t} className="card space-y-2 text-zinc-900" aria-label={teamNames[t]}>
                <h3 className="flex items-center gap-2 text-sm font-semibold"><span className={`h-3 w-3 rounded-full ${t === 0 ? 'bg-orange-500' : 'bg-blue-600'}`} />{teamNames[t]} <span className="text-xs font-normal text-zinc-500">({list.length}/{per})</span></h3>
                <ul className="min-h-[2.5rem] space-y-1.5">
                  {list.map((m) => (
                    <li key={m.uid} className="flex items-center gap-2 text-sm"><Avatar p={{ display_name: m.name, avatar_url: m.avatar }} size={24} /><span className="truncate">{m.name}</span>
                      {m.gk && per >= 2 && <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">{w.gkBadge}</span>}
                      {m.host && <span className="rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-600">{w.host}</span>}{m.uid === me && <span className="text-[10px] text-zinc-500">({w.you})</span>}</li>
                  ))}
                </ul>
                {mine && mine.team === t && per >= 2 && (
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mine.gk === true} disabled={mine.gk !== true && list.some((m) => m.gk === true)} onChange={(e) => room.current?.setMe({ gk: e.target.checked })} />{w.gkPlay}</label>
                )}
                {mine && mine.team !== t && <button type="button" className="btn btn-ghost btn-sm" disabled={full} onClick={() => room.current?.setMe({ team: t })}>{full ? w.full : w.takeTeam}</button>}
              </section>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">{w.fillAi}</p>
        {mode === 'host'
          ? <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 w-full" disabled={!connected} onClick={startOnline}>{w.startMatch}</button>
          : <p className="rounded-lg bg-zinc-100 px-3 py-2 text-center text-sm text-zinc-700">{w.waitHost}</p>}
      </div>
    );
  }

  // ---- the menu ----
  const open = lobbyRows.filter((r) => r.code);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={w.title} sub={w.sub} />

      <section className="card space-y-3 text-zinc-900">
        <div className="flex items-center gap-2"><Gamepad2 className="h-5 w-5" aria-hidden="true" /><h2 className="text-base font-semibold">{w.local}</h2></div>
        <p className="text-sm text-zinc-600">{w.localSub}</p>
        <div>
          <span className="label">{w.perTeam}</span>
          <div className="flex flex-wrap gap-2">{SIZES.map((k) => <Chip key={k} active={n === k} onClick={() => setN(k)}>{k}</Chip>)}</div>
        </div>
        <div>
          <span className="label">{w.minutes}</span>
          <div className="flex flex-wrap gap-2">{LENGTHS.map((k) => <Chip key={k} active={minutes === k} onClick={() => setMinutes(k)}>{k}</Chip>)}</div>
        </div>
        {n >= 2 && (
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepers[0]} onChange={(e) => setKeepers([e.target.checked, keepers[1]])} />{w.p1Gk}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={keepers[1]} onChange={(e) => setKeepers([keepers[0], e.target.checked])} />{w.p2Gk}</label>
          </div>
        )}
        <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={startLocal}>{w.local}</button>
      </section>

      <section className="card space-y-3 text-zinc-900">
        <div className="flex items-center gap-2"><Wifi className="h-5 w-5" aria-hidden="true" /><h2 className="text-base font-semibold">{w.online}</h2></div>
        {!user ? (
          <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={() => openAuth('signin')}>{w.signIn}</button>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700" onClick={hostMatch}>{w.hostBtn}</button>
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); joinCode(codeInput); }}>
                <input className={`${field} w-32 uppercase tracking-widest`} value={codeInput} maxLength={5} placeholder={w.codePh} aria-label={w.joinCode} onChange={(e) => setCodeInput(cleanCode(e.target.value))} />
                <button className="btn btn-ghost">{w.join}</button>
              </form>
            </div>
            <h3 className="pt-1 text-sm font-semibold">{w.openMatches}</h3>
            {open.length === 0 ? <Empty text={w.noMatches} /> : (
              <ul className="space-y-2">
                {open.map((r) => (
                  <li key={r.code} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2.5">
                    <Avatar p={{ display_name: r.host, avatar_url: r.avatar }} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{w.hostOf(r.host)}</p>
                      <p className="flex items-center gap-2 text-xs text-zinc-600"><span>{w.matchOf(r.n, r.minutes)}</span><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{w.humansN(r.humans)}</span></p>
                    </div>
                    <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 btn-sm" onClick={() => joinCode(r.code)}>{w.join}</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card space-y-1 text-xs text-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-900">{w.helpTitle}</h2>
        <p>{w.helpP1}</p><p>{w.helpP2}</p><p>{w.helpOnline}</p><p>{w.helpTouch}</p><p>{w.keysLegend}</p><p>{w.helpGk}</p>
      </section>
    </div>
  );
}
