import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { NO_CMD, createMatch, setHumans, step, type Cmd, type Match } from '../../game/football/engine';
import { Animator, draw, newCamera, type Ring } from '../../game/football/render';
import { Keys, MAP_ANY, MAP_P1, MAP_P2, mergeCmd } from '../../game/football/input';
import { blend, fromSnap, toSnap, toView, type Snap, type View } from '../../game/football/view';
import type { Room, RosterEntry } from '../../game/football/net';
import type { FootballWords } from '../../lib/footballText';
import { TouchPad } from './TouchPad';

export interface GameProps {
  mode: 'local' | 'host' | 'client'; n: number; minutes: number; roster: RosterEntry[]; myRid: number; room: Room | null;
  bus: MutableRefObject<((event: string, payload: unknown) => void) | null>;
  words: FootballWords; teamNames: [string, string]; onQuit: () => void; onEnd: (score: [number, number]) => void;
}

const STEP = 1 / 60;
const emptyCmd = (): Cmd => ({ ...NO_CMD });
interface Frame { t: number; view: View; h: number[] }

/** The match screen: draws the pitch, reads the controls and, on the host's device (or in a local game), runs the match. */
export function FootballGame({ mode, n, minutes, roster, myRid, room, bus, words, teamNames, onQuit, onEnd }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const touch = useRef<[Cmd, Cmd]>([emptyCmd(), emptyCmd()]);
  const rosterRef = useRef(roster); rosterRef.current = roster;
  const applyRef = useRef<(() => void) | null>(null);
  const paused = useRef(false);
  const [pausedUi, setPausedUi] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const coarse = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches, []);
  const wordsRef = useRef(words); wordsRef.current = words;
  const myRidRef = useRef(myRid); myRidRef.current = myRid;
  const namesRef = useRef(teamNames); namesRef.current = teamNames;

  useEffect(() => { applyRef.current?.(); }, [roster]);

  useEffect(() => {
    const cv = canvas.current; const box = wrap.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !box || !ctx) return undefined;
    const keys = new Keys(); keys.attach();
    const cam = newCamera(); const anim = new Animator();
    let m: Match | null = null;
    const remote: Record<number, { cmd: Cmd; t: number }> = {};
    const frames: Frame[] = [];
    let ended = false; let raf = 0; let last = performance.now(); let acc = 0; let sendT = 0;
    let lastSig = ''; let lastSend = 0;
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';

    const apply = () => {
      if (!m) return;
      if (mode === 'local') setHumans(m, [{ id: 0, team: 0 }, { id: 1, team: 1 }]);
      else setHumans(m, rosterRef.current.map((r) => ({ id: r.rid, team: r.team })));
    };
    if (mode !== 'client') { m = createMatch(n, minutes); apply(); }
    applyRef.current = apply;

    bus.current = (event, payload) => {
      if (event === 'in' && mode === 'host') {
        const p = payload as { r: number; mx: number; my: number; sp: boolean; a: boolean; b: boolean };
        if (typeof p?.r === 'number') remote[p.r] = { cmd: { mx: Number(p.mx) || 0, my: Number(p.my) || 0, sp: !!p.sp, a: !!p.a, b: !!p.b }, t: performance.now() };
      } else if (event === 'snap' && mode === 'client') {
        const s = payload as Snap;
        if (!s || !Array.isArray(s.p)) return;
        frames.push({ t: performance.now(), view: fromSnap(s), h: s.h ?? [] });
        if (frames.length > 6) frames.shift();
      }
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = box.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
      setPortrait(r.height > r.width);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);

    const nameOf = (rid: number): string => (rosterRef.current.find((r) => r.rid === rid)?.name ?? '').split(' ')[0].slice(0, 10);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      let view: View | null = null; const rings: Ring[] = [];
      const mine = mergeCmd(keys.read(MAP_ANY), touch.current[0]);

      if (m) {
        if (!paused.current) {
          acc += dt;
          const cmds: Record<number, Cmd> = {};
          if (mode === 'local') { cmds[0] = mergeCmd(keys.read(MAP_P1), touch.current[0]); cmds[1] = mergeCmd(keys.read(MAP_P2), touch.current[1]); }
          else {
            for (const r of rosterRef.current) {
              if (r.rid === myRidRef.current) cmds[r.rid] = mine;
              else { const x = remote[r.rid]; cmds[r.rid] = x && now - x.t < 1200 ? x.cmd : NO_CMD; }
            }
          }
          while (acc >= STEP) { step(m, STEP, cmds); acc -= STEP; }
          if (mode === 'host' && room && now - sendT > 83) { sendT = now; room.send('snap', toSnap(m, new Map(rosterRef.current.map((r) => [r.rid, r.rid])))); }
        }
        view = toView(m);
        for (const h of m.humans) {
          if (h.pidx < 0) continue;
          if (mode === 'local') rings.push({ pidx: h.pidx, color: h.id === 0 ? '#fde047' : '#f9a8d4', label: h.id === 0 ? wordsRef.current.p1 : wordsRef.current.p2 });
          else rings.push({ pidx: h.pidx, color: h.id === myRidRef.current ? '#fde047' : '#ffffff', label: h.id === myRidRef.current ? '' : nameOf(h.id) });
        }
      } else if (frames.length) {
        const rt = now - 130;
        let a = frames[0]; let b = frames[frames.length - 1];
        for (let i = 0; i < frames.length - 1; i += 1) if (frames[i].t <= rt && frames[i + 1].t >= rt) { a = frames[i]; b = frames[i + 1]; break; }
        const t = a === b ? 1 : Math.max(0, Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t)));
        view = blend(a.view, b.view, t);
        const lastF = frames[frames.length - 1];
        for (let i = 0; i + 1 < lastF.h.length; i += 2) {
          const rid = lastF.h[i]; const pidx = lastF.h[i + 1];
          rings.push({ pidx, color: rid === myRidRef.current ? '#fde047' : '#ffffff', label: rid === myRidRef.current ? '' : nameOf(rid) });
        }
        // my controls go to the host: on change, on button presses, and now and then as a keep-alive
        const q = (v: number) => Math.round(v * 10) / 10;
        const btn = `${+mine.sp}${+mine.a}${+mine.b}`;
        const sig = `${q(mine.mx)},${q(mine.my)},${btn}`;
        const btnChanged = lastSig.split(',')[2] !== btn;
        if (room && ((sig !== lastSig && now - lastSend > 110) || (btnChanged && sig !== lastSig && now - lastSend > 40) || now - lastSend > 500)) {
          room.send('in', { r: myRidRef.current, mx: q(mine.mx), my: q(mine.my), sp: mine.sp, a: mine.a, b: mine.b });
          lastSig = sig; lastSend = now;
        }
      }

      if (view) {
        draw(ctx, cv.width, cv.height, view, cam, anim, dt, rings, { teams: namesRef.current, kickoff: wordsRef.current.kickoff, goal: wordsRef.current.goal, fullTime: wordsRef.current.fullTime, throwIn: wordsRef.current.out }, Math.min(2, window.devicePixelRatio || 1));
        if (view.phase === 'end' && !ended) { ended = true; onEnd(view.score); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); keys.detach(); bus.current = null; applyRef.current = null;
      document.body.style.overflow = prevOverflow;
    };
    // The match is created once for these settings; people joining or leaving are applied through `roster`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, n, minutes]);

  const setPause = (v: boolean) => { paused.current = v; setPausedUi(v); };
  const labels = { pass: words.pass, shoot: words.shoot, sprint: words.sprint };

  return (
    <div ref={wrap} className="fixed inset-0 z-[60] select-none bg-black" style={{ touchAction: 'none' }}>
      <canvas ref={canvas} className="h-full w-full" />
      <div className="absolute right-2 top-2 z-10 flex gap-2">
        {mode === 'local' && (
          <button type="button" aria-label={words.pause} className="rounded-full bg-slate-900/80 p-2 text-white" onClick={() => setPause(true)}><Pause className="h-4 w-4" aria-hidden="true" /></button>
        )}
        <button type="button" aria-label={words.quit} className="rounded-full bg-slate-900/80 p-2 text-white" onClick={onQuit}><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      {portrait && coarse && <p className="absolute inset-x-0 top-14 z-10 px-4 text-center text-xs font-semibold text-white">{words.rotate}</p>}
      {mode === 'host' && <p className="absolute inset-x-0 bottom-1 z-10 text-center text-[10px] text-white/60">{words.keepOpen}</p>}
      {coarse && mode === 'local' && (<><TouchPad side="left" color="#f97316" labels={labels} onChange={(c) => { touch.current[0] = c; }} /><TouchPad side="right" color="#2563eb" labels={labels} onChange={(c) => { touch.current[1] = c; }} /></>)}
      {coarse && mode !== 'local' && <TouchPad side="all" color="#f97316" labels={labels} onChange={(c) => { touch.current[0] = c; }} />}
      {pausedUi && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="space-y-3 rounded-2xl bg-white p-5 text-center text-zinc-900">
            <button type="button" className="btn bg-zinc-900 text-white hover:bg-zinc-700 w-full" onClick={() => setPause(false)}><Play className="h-4 w-4" aria-hidden="true" />{words.resume}</button>
            <button type="button" className="btn btn-ghost w-full" onClick={onQuit}>{words.quit}</button>
          </div>
        </div>
      )}
    </div>
  );
}
