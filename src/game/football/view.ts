import { L, W, type Match, type Phase, type Team } from './engine';

/** What the screen needs to draw one moment of a match, from the engine or from a network snapshot. */
export interface VPlayer { x: number; y: number; ang: number; sp: number; team: Team; role: 'gk' | 'def' | 'mid' | 'fwd'; flags: number; human: number }
export interface View {
  n: number; duration: number; clock: number; phase: Phase; phaseT: number; scorer: Team | -1; score: [number, number];
  ball: { x: number; y: number; owner: number }; players: VPlayer[];
}
export const F_BALL = 1; export const F_TACKLE = 2; export const F_STUN = 4;

export function toView(m: Match): View {
  return {
    n: m.n, duration: m.duration, clock: m.clock, phase: m.phase, phaseT: m.phaseT, scorer: m.scorer, score: [m.score[0], m.score[1]],
    ball: { x: m.ball.x, y: m.ball.y, owner: m.ball.owner },
    players: m.players.map((p) => ({
      x: p.x, y: p.y, ang: p.ang, sp: Math.hypot(p.vx, p.vy), team: p.team, role: p.role, human: -1,
      flags: (m.ball.owner === p.id ? F_BALL : 0) | (p.tack > 0 ? F_TACKLE : 0) | (p.stun > 0 ? F_STUN : 0),
    })),
  };
}

const PHASES: Phase[] = ['kickoff', 'play', 'restart', 'goal', 'end'];
const ROLES = ['gk', 'def', 'mid', 'fwd'] as const;

/** A compact copy of the match for the network: numbers only, positions in decimetres. */
export interface Snap { n: number; d: number; c: number; s: [number, number]; ph: number; pt: number; sc: number; b: [number, number, number]; p: number[][]; h: number[] }

export function toSnap(m: Match, rids: Map<number, number>): Snap {
  const h: number[] = [];
  for (const hu of m.humans) { const rid = rids.get(hu.id); if (rid !== undefined && hu.pidx >= 0) h.push(rid, hu.pidx); }
  return {
    n: m.n, d: m.duration, c: Math.round(m.clock * 10), s: [m.score[0], m.score[1]], ph: PHASES.indexOf(m.phase), pt: Math.round(m.phaseT * 10), sc: m.scorer,
    b: [Math.round(m.ball.x * 10), Math.round(m.ball.y * 10), m.ball.owner],
    p: m.players.map((p) => [Math.round(p.x * 10), Math.round(p.y * 10), Math.round(((p.ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 256) & 255, Math.round(Math.hypot(p.vx, p.vy) * 4),
      (m.ball.owner === p.id ? F_BALL : 0) | (p.tack > 0 ? F_TACKLE : 0) | (p.stun > 0 ? F_STUN : 0)]),
    h,
  };
}

export function fromSnap(s: Snap): View {
  const view: View = {
    n: s.n, duration: s.d, clock: s.c / 10, phase: PHASES[s.ph] ?? 'play', phaseT: s.pt / 10, scorer: s.sc === 0 ? 0 : s.sc === 1 ? 1 : -1, score: [s.s[0], s.s[1]],
    ball: { x: s.b[0] / 10, y: s.b[1] / 10, owner: s.b[2] },
    players: s.p.map((q, i) => ({ x: q[0] / 10, y: q[1] / 10, ang: (q[2] / 256) * Math.PI * 2, sp: q[3] / 4, team: i < s.n ? 0 : 1, role: roleOf(s.n, i % s.n), flags: q[4], human: -1 })),
  };
  return view;
}

/** Roles follow the same formation as the engine, so the network need not carry them. */
function roleOf(n: number, i: number): 'gk' | 'def' | 'mid' | 'fwd' {
  if (n <= 1) return 'fwd';
  if (n === 2) return i === 0 ? 'def' : 'fwd';
  if (i === 0) return 'gk';
  const f = n - 1;
  let d = Math.max(1, Math.round(f * 0.4)); let fw = Math.max(1, Math.round(f * 0.2));
  while (d + fw > f) { if (d > 1) d -= 1; else fw -= 1; }
  const k = i - 1;
  return ROLES[k < d ? 1 : k < f - fw ? 2 : 3];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpAng = (a: number, b: number, t: number): number => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

export function blend(a: View, b: View, t: number): View {
  if (a.players.length !== b.players.length) return b;
  return {
    ...b,
    ball: { x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t), owner: b.ball.owner },
    players: b.players.map((q, i) => { const p = a.players[i]; return { ...q, x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), ang: lerpAng(p.ang, q.ang, t), sp: lerp(p.sp, q.sp, t) }; }),
  };
}

export const PITCH = { L, W };
