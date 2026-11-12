/**
 * Kezzo football: the match simulation. Pure TypeScript, no browser code, so the same rules run on the host's device
 * and (for local games) on the only device. Units are metres and seconds; the pitch is 105 x 68.
 * Team 0 attacks the right goal (x = L), team 1 attacks the left goal (x = 0).
 */
export const L = 105;
export const W = 68;
export const GOAL_W = 7.32;
export const GOAL_D = 2.4;
export type Team = 0 | 1;
export type Role = 'gk' | 'def' | 'mid' | 'fwd';
export type Phase = 'kickoff' | 'play' | 'restart' | 'goal' | 'end';

/** What one person is doing right now: a stick direction and three held buttons (pass, shoot, sprint). */
export interface Cmd { mx: number; my: number; sp: boolean; a: boolean; b: boolean }
export const NO_CMD: Cmd = { mx: 0, my: 0, sp: false, a: false, b: false };

export interface Player {
  id: number; team: Team; role: Role; fx: number; fy: number;
  x: number; y: number; vx: number; vy: number; ang: number; stam: number;
  cool: number; tack: number; tcool: number; stun: number; tackUsed: boolean; anim: number; human: number;
  think: number; want: '' | 'pass' | 'shoot'; hold: number; dribX: number; dribY: number; ptarget: number;
}
export interface Human { id: number; team: Team; pidx: number; prevA: boolean; prevB: boolean; hold: number; lock: number }
export interface Ball { x: number; y: number; vx: number; vy: number; owner: number; last: Team }
export interface Match {
  n: number; duration: number; clock: number; phase: Phase; phaseT: number;
  players: Player[]; ball: Ball; score: [number, number]; humans: Human[];
  kickTeam: Team; restart: { team: Team; x: number; y: number }; scorer: Team | -1;
}

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
const dirOf = (t: Team): number => (t === 0 ? 1 : -1);
const goalX = (t: Team): number => (t === 0 ? L : 0); // the goal this team attacks
const ownGoalX = (t: Team): number => (t === 0 ? 0 : L);

interface Slot { role: Role; fx: number; fy: number }

/** Where a team of n players stands, in "team" coordinates: fx 0 = own goal line, 1 = the goal it attacks; fy across the pitch. */
export function formation(n: number): Slot[] {
  if (n <= 1) return [{ role: 'fwd', fx: 0.3, fy: 0.5 }];
  if (n === 2) return [{ role: 'def', fx: 0.2, fy: 0.5 }, { role: 'fwd', fx: 0.4, fy: 0.5 }];
  const out: Slot[] = [{ role: 'gk', fx: 0.03, fy: 0.5 }];
  const f = n - 1;
  let d = Math.max(1, Math.round(f * 0.4));
  let fw = Math.max(1, Math.round(f * 0.2));
  while (d + fw > f) { if (d > 1) d -= 1; else fw -= 1; }
  const m = f - d - fw;
  const line = (role: Role, count: number, fx: number) => {
    for (let i = 0; i < count; i += 1) out.push({ role, fx, fy: count === 1 ? 0.5 : 0.1 + (0.8 * i) / (count - 1) });
  };
  line('def', d, 0.17); line('mid', m, 0.31); line('fwd', fw, 0.44);
  return out;
}

const home = (p: Player): { x: number; y: number } => (p.team === 0 ? { x: p.fx * L, y: p.fy * W } : { x: (1 - p.fx) * L, y: (1 - p.fy) * W });

export function createMatch(n: number, minutes: number): Match {
  const size = clamp(Math.round(n), 1, 11);
  const players: Player[] = [];
  for (const team of [0, 1] as Team[]) {
    for (const s of formation(size)) {
      players.push({ id: players.length, team, role: s.role, fx: s.fx, fy: s.fy, x: 0, y: 0, vx: 0, vy: 0, ang: team === 0 ? 0 : Math.PI, stam: 1,
        cool: 0, tack: 0, tcool: 0, stun: 0, tackUsed: false, anim: Math.random() * 6, human: -1, think: Math.random() * 0.3, want: '', hold: 0, dribX: 0, dribY: 0, ptarget: -1 });
    }
  }
  const m: Match = {
    n: size, duration: clamp(minutes, 1, 20) * 60, clock: 0, phase: 'kickoff', phaseT: 0, players,
    ball: { x: L / 2, y: W / 2, vx: 0, vy: 0, owner: -1, last: 0 }, score: [0, 0], humans: [],
    kickTeam: 0, restart: { team: 0, x: L / 2, y: W / 2 }, scorer: -1,
  };
  startKickoff(m, 0);
  return m;
}

function startKickoff(m: Match, team: Team): void {
  m.kickTeam = team; m.phase = 'kickoff'; m.phaseT = 0;
  for (const p of m.players) {
    const h = home(p);
    p.x = h.x; p.y = h.y; p.vx = 0; p.vy = 0; p.tack = 0; p.stun = 0; p.cool = 0; p.want = ''; p.hold = 0;
    p.ang = p.team === 0 ? 0 : Math.PI;
  }
  // the player who kicks off stands on the centre spot with the ball
  const mine = m.players.filter((p) => p.team === team && p.role !== 'gk');
  const taker = mine.reduce((best, p) => (Math.abs(p.fx - 0.44) < Math.abs(best.fx - 0.44) ? p : best), mine[0] ?? m.players[0]);
  taker.x = L / 2 - dirOf(team) * 0.7; taker.y = W / 2;
  m.ball = { x: L / 2, y: W / 2, vx: 0, vy: 0, owner: taker.id, last: team };
  for (const h of m.humans) h.pidx = -1;
}

/** Sets who is playing. People keep the footballer they control; new people get one on the next step. */
export function setHumans(m: Match, list: Array<{ id: number; team: Team }>): void {
  const keep = new Map(m.humans.map((h) => [h.id, h]));
  m.humans = list.map((x) => {
    const old = keep.get(x.id);
    return old && old.team === x.team ? old : { id: x.id, team: x.team, pidx: -1, prevA: false, prevB: false, hold: 0, lock: 0 };
  });
  for (const p of m.players) if (!m.humans.some((h) => h.id === p.human)) p.human = -1;
}

interface Intent { mx: number; my: number; sp: boolean; pass: boolean; shoot: boolean; power: number; tackle: boolean; ax: number; ay: number; passTo: number }
const idle = (): Intent => ({ mx: 0, my: 0, sp: false, pass: false, shoot: false, power: 0.8, tackle: false, ax: 0, ay: 0, passTo: -1 });

function nearestOpp(m: Match, team: Team, x: number, y: number): number {
  let best = 99;
  for (const q of m.players) if (q.team !== team) best = Math.min(best, dist(q.x, q.y, x, y));
  return best;
}

/** Who a pass from p towards (ax, ay) should go to, or -1 when nobody is in that direction. */
function pickPass(m: Match, p: Player, ax: number, ay: number): number {
  const len = Math.hypot(ax, ay) || 1;
  const ux = ax / len; const uy = ay / len;
  let best = -1; let bestScore = -99;
  for (const q of m.players) {
    if (q.team !== p.team || q.id === p.id) continue;
    const dx = q.x - p.x; const dy = q.y - p.y; const d = Math.hypot(dx, dy);
    if (d < 3 || d > 45) continue;
    const cos = (dx * ux + dy * uy) / d;
    if (cos < 0.6) continue;
    const covered = nearestOpp(m, p.team, q.x, q.y) < 3 ? 0.9 : 0;
    const score = cos * 2 - d / 40 - covered + (q.role === 'gk' ? -0.6 : 0);
    if (score > bestScore) { bestScore = score; best = q.id; }
  }
  return best;
}

function kick(m: Match, p: Player, dx: number, dy: number, speed: number): void {
  const len = Math.hypot(dx, dy) || 1;
  m.ball.vx = (dx / len) * speed; m.ball.vy = (dy / len) * speed;
  m.ball.owner = -1; m.ball.last = p.team;
  p.cool = 0.3; p.ang = Math.atan2(dy, dx);
  m.ball.x = p.x + (dx / len) * 0.9; m.ball.y = p.y + (dy / len) * 0.9;
}

function doPass(m: Match, p: Player, it: Intent): void {
  const aimx = it.ax || Math.cos(p.ang); const aimy = it.ay || Math.sin(p.ang);
  const t = it.passTo >= 0 ? it.passTo : pickPass(m, p, aimx, aimy);
  if (t < 0) { kick(m, p, aimx + rnd(-0.05, 0.05), aimy + rnd(-0.05, 0.05), 15); return; }
  const q = m.players[t];
  const lead = 0.45;
  const tx = q.x + q.vx * lead; const ty = q.y + q.vy * lead;
  const d = dist(p.x, p.y, tx, ty);
  kick(m, p, tx - p.x + rnd(-0.4, 0.4), ty - p.y + rnd(-0.4, 0.4), clamp(8 + d * 0.95, 9, 26));
}

function doShoot(m: Match, p: Player, it: Intent): void {
  let ax = it.ax || Math.cos(p.ang); let ay = it.ay || Math.sin(p.ang);
  const gx = goalX(p.team);
  const dg = dist(p.x, p.y, gx, W / 2);
  const toGoalX = gx - p.x; const toGoalY = W / 2 - p.y;
  const cos = (ax * toGoalX + ay * toGoalY) / ((Math.hypot(ax, ay) || 1) * (Math.hypot(toGoalX, toGoalY) || 1));
  if (cos > 0.8 && dg < 42) { // gentle aim help when shooting roughly at goal
    const tx = gx - p.x; const ty = W / 2 + rnd(-GOAL_W / 2 + 0.6, GOAL_W / 2 - 0.6) - p.y;
    const l1 = Math.hypot(ax, ay) || 1; const l2 = Math.hypot(tx, ty) || 1;
    ax = (ax / l1) * 0.4 + (tx / l2) * 0.6; ay = (ay / l1) * 0.4 + (ty / l2) * 0.6;
  }
  const power = clamp(it.power, 0.3, 1);
  const err = (Math.random() - 0.5) * 0.22 * power * (1 + dg / 45);
  const c = Math.cos(err); const s = Math.sin(err);
  kick(m, p, ax * c - ay * s, ax * s + ay * c, 13 + 17 * power);
}

/** Moves the footballer p towards a spot, slowing down as it gets close. */
function seek(it: Intent, p: Player, tx: number, ty: number, run: boolean): void {
  const dx = tx - p.x; const dy = ty - p.y; const d = Math.hypot(dx, dy);
  if (d < 0.25) return;
  const f = clamp(d / 2.2, 0, 1);
  it.mx = (dx / d) * f; it.my = (dy / d) * f; it.sp = run && d > 5;
}

/** The best teammate to pass to for an AI player: ahead of it and not marked. */
function bestForwardPass(m: Match, p: Player, minAdvance: number): { id: number; adv: number } {
  const dir = dirOf(p.team);
  let best = -1; let bs = -99; let badv = 0;
  for (const q of m.players) {
    if (q.team !== p.team || q.id === p.id || q.role === 'gk') continue;
    const d = dist(p.x, p.y, q.x, q.y);
    const adv = (q.x - p.x) * dir;
    if (d < 5 || d > 36 || adv < minAdvance) continue;
    const sc = adv / 20 - (nearestOpp(m, p.team, q.x, q.y) < 4.5 ? 1.5 : 0) - d / 60;
    if (sc > bs) { bs = sc; best = q.id; badv = adv; }
  }
  return { id: bs > -0.9 ? best : -1, adv: badv };
}

function aiKeeper(m: Match, p: Player, dt: number): Intent {
  const it = idle();
  const b = m.ball;
  const gx = ownGoalX(p.team); const inward = dirOf(p.team);
  if (b.owner === p.id) {
    p.hold += dt;
    if (p.hold > 0.9) { p.hold = 0; it.pass = true; it.ax = inward; it.ay = rnd(-0.6, 0.6); }
    return it;
  }
  p.hold = 0;
  let ty = W / 2 + clamp((b.y - W / 2) * 0.3, -3.4, 3.4);
  let tx = gx + inward * clamp(1.4 + dist(b.x, b.y, gx, W / 2) * 0.05, 1.4, 6);
  const towardGoal = (b.vx * -inward) > 4;
  if (towardGoal) {
    const t = (gx - b.x) / b.vx;
    const yAt = b.y + b.vy * t;
    if (t > 0 && t < 1.4 && Math.abs(yAt - W / 2) < GOAL_W / 2 + 3) { ty = clamp(yAt + (p.id % 3 - 1) * 1.6, W / 2 - GOAL_W / 2, W / 2 + GOAL_W / 2); tx = gx + inward * 1.2; it.sp = true; }
  } else if (b.owner < 0 && Math.abs(b.x - gx) < 14 && Math.abs(b.y - W / 2) < 20 && Math.hypot(b.vx, b.vy) < 6) {
    let closest = true;
    for (const q of m.players) if (q.id !== p.id && dist(q.x, q.y, b.x, b.y) < dist(p.x, p.y, b.x, b.y) - 1) closest = false;
    if (closest) { tx = b.x; ty = b.y; it.sp = true; }
  }
  seek(it, p, tx, ty, it.sp);
  return it;
}

function aiField(m: Match, p: Player, dt: number): Intent {
  const it = idle();
  const b = m.ball;
  const dir = dirOf(p.team);
  const gx = goalX(p.team);
  const owner = b.owner >= 0 ? m.players[b.owner] : null;
  const teamHas = owner !== null && owner.team === p.team;
  p.think -= dt;

  if (m.phase === 'restart') {
    const rs = m.restart;
    if (p.team === rs.team) {
      let nearest = -1; let nd = 999;
      for (const q of m.players) {
        if (q.team !== p.team || (q.role === 'gk' && rs.x > 8 && rs.x < L - 8)) continue;
        const d = dist(q.x, q.y, b.x, b.y); if (d < nd) { nd = d; nearest = q.id; }
      }
      if (nearest === p.id) { seek(it, p, b.x, b.y, true); return it; }
    } else if (dist(p.x, p.y, b.x, b.y) < 7) {
      seek(it, p, p.x + (p.x - b.x), p.y + (p.y - b.y), false); return it;
    }
  }

  // with the ball
  if (owner === p) {
    if (p.think <= 0) {
      p.think = rnd(0.2, 0.4);
      const dg = dist(p.x, p.y, gx, W / 2);
      const pressed = nearestOpp(m, p.team, p.x, p.y) < 2.6;
      p.want = ''; p.ptarget = -1;
      const fwd = bestForwardPass(m, p, 6);
      if (dg < 31 && Math.random() < 0.18 + (31 - dg) / 30) p.want = 'shoot';
      else if (fwd.id >= 0 && Math.random() < (pressed ? 0.85 : 0.38)) { p.want = 'pass'; p.ptarget = fwd.id; }
      else if (pressed && Math.random() < 0.7) { const any = bestForwardPass(m, p, -12); if (any.id >= 0) { p.want = 'pass'; p.ptarget = any.id; } }
      // run towards goal, bending round nearby opponents
      let dx = dir; let dy = clamp((W / 2 - p.y) / 40, -0.5, 0.5);
      for (const q of m.players) {
        if (q.team === p.team) continue;
        const d = dist(p.x, p.y, q.x, q.y);
        if (d < 5 && d > 0.01) {
          const f = (5 - d) / 5;
          const ahead = (q.x - p.x) * dir > 0;
          dx += ((p.x - q.x) / d) * f * 1.1;
          const side = Math.abs(p.y - q.y) < 0.8 ? (p.id % 2 ? 1 : -1) : Math.sign(p.y - q.y); // dodge to the free side
          dy += side * f * (ahead ? 2.6 : 1.2);
        }
      }
      p.dribX = dx; p.dribY = dy;
    }
    const l = Math.hypot(p.dribX, p.dribY) || 1;
    it.mx = p.dribX / l; it.my = p.dribY / l; it.sp = Math.abs(p.x - gx) > 16;
    if (p.want === 'shoot') { it.shoot = true; it.power = rnd(0.7, 1); it.ax = gx - p.x; it.ay = W / 2 + rnd(-3.1, 3.1) - p.y; p.want = ''; }
    else if (p.want === 'pass') {
      p.want = '';
      if (p.ptarget >= 0) { it.pass = true; it.passTo = p.ptarget; }
    }
    return it;
  }

  // who should chase the ball
  const target = owner && owner.team !== p.team ? owner : null;
  const bx = target ? target.x : b.x + b.vx * 0.25; const by = target ? target.y : b.y + b.vy * 0.25;
  if (!teamHas && m.phase !== 'restart') {
    const mine = m.players.filter((q) => q.team === p.team && q.role !== 'gk' && q.human < 0).map((q) => ({ id: q.id, d: dist(q.x, q.y, bx, by) })).sort((a, c) => a.d - c.d);
    const rank = mine.findIndex((q) => q.id === p.id);
    const chasers = m.n >= 5 ? 2 : 1;
    if (rank >= 0 && rank < chasers && (rank === 0 || dist(p.x, p.y, bx, by) < 25)) {
      seek(it, p, bx, by, true);
      if (dist(p.x, p.y, bx, by) > 1.2) it.sp = true;
      if (target && dist(p.x, p.y, target.x, target.y) < 2 && p.tcool <= 0 && Math.random() < dt * 6) it.tackle = true;
      return it;
    }
  }

  // otherwise keep shape: the formation spot, shifted by where the ball is
  const adv = clamp((p.team === 0 ? b.x : L - b.x) / L, 0, 1);
  const ballFy = clamp((p.team === 0 ? b.y : W - b.y) / W, 0, 1);
  const w = p.role === 'fwd' ? 0.7 : p.role === 'mid' ? 0.45 : 0.2;
  let fx = p.fx; let fy = p.fy;
  if (teamHas) {
    fx = clamp(p.fx + Math.max(0, adv - 0.3) * 0.55 * w * 1.4, 0.05, 0.93);
    fy = clamp(p.fy + (ballFy - 0.5) * 0.35, 0.05, 0.95);
    if (p.role === 'fwd' && owner) fx = Math.max(fx, clamp((((owner.x - (p.team === 0 ? 0 : L)) * dir) + 9) / L, 0, 0.95));
  } else {
    fx = clamp(p.fx + (adv - 0.5) * 0.28 - (p.role === 'def' ? 0.04 : 0), 0.04, 0.9);
    fy = clamp(p.fy + (ballFy - 0.5) * 0.32, 0.05, 0.95);
  }
  const tx = p.team === 0 ? fx * L : (1 - fx) * L;
  const ty = p.team === 0 ? fy * W : (1 - fy) * W;
  seek(it, p, tx, ty, false);
  return it;
}

function humanIntent(m: Match, p: Player, h: Human, c: Cmd, dt: number): Intent {
  const it = idle();
  const mag = Math.hypot(c.mx, c.my);
  if (mag > 0.12) { it.mx = c.mx / Math.max(1, mag); it.my = c.my / Math.max(1, mag); }
  it.sp = c.sp;
  it.ax = mag > 0.3 ? c.mx : Math.cos(p.ang); it.ay = mag > 0.3 ? c.my : Math.sin(p.ang);
  const hasBall = m.ball.owner === p.id;
  const aDown = c.a && !h.prevA; const bDown = c.b && !h.prevB; const bUp = !c.b && h.prevB;
  const ballNear = m.ball.owner < 0 && dist(p.x, p.y, m.ball.x, m.ball.y) < 1.5;
  if (hasBall) {
    if (aDown) it.pass = true;
    if (c.b) h.hold += dt;
    if (bUp) { it.shoot = true; it.power = 0.35 + 0.65 * clamp(h.hold / 0.7, 0, 1); }
  } else {
    if (ballNear && p.cool <= 0) { if (aDown) it.pass = true; if (bDown) { it.shoot = true; it.power = 0.7; } }
    else if (bDown) it.tackle = true;
  }
  if (!c.b) h.hold = 0;
  h.prevA = c.a; h.prevB = c.b;
  return it;
}

/** Decides which footballer each person controls: the one with the ball, or the closest to it. */
function assignHumans(m: Match, dt: number, cmds: Record<number, Cmd>): void {
  for (const p of m.players) p.human = -1;
  for (const team of [0, 1] as Team[]) {
    const hs = m.humans.filter((h) => h.team === team);
    if (!hs.length) continue;
    const field = m.players.filter((p) => p.team === team && p.role !== 'gk');
    if (!field.length) continue;
    const owner = m.ball.owner >= 0 ? m.players[m.ball.owner] : null;
    const key = (p: Player): number => (owner && owner.id === p.id ? -1 : dist(p.x, p.y, m.ball.x, m.ball.y));
    const sorted = [...field].sort((a, c) => key(a) - key(c));
    const taken = new Set<number>();
    for (const h of hs) h.lock = Math.max(0, h.lock - dt);
    // keep whoever they already control, unless it is clearly no longer close to the action
    for (const h of hs) {
      const cur = h.pidx >= 0 ? m.players[h.pidx] : null;
      if (!cur || cur.team !== team || cur.role === 'gk' || taken.has(cur.id)) { h.pidx = -1; continue; }
      const rank = sorted.findIndex((q) => q.id === cur.id);
      const c = cmds[h.id];
      if (c && c.a && !h.prevA && !(owner && owner.id === cur.id) && !(m.ball.owner < 0 && dist(cur.x, cur.y, m.ball.x, m.ball.y) < 1.5)) { h.pidx = -1; continue; } // pressed pass without the ball: switch
      if (h.lock <= 0 && rank >= hs.length + 2) { h.pidx = -1; continue; }
      if (h.lock <= 0 && owner && owner.team === team && owner.id !== cur.id && !m.humans.some((o) => o.pidx === owner.id)) { h.pidx = -1; continue; }
      taken.add(cur.id);
    }
    for (const h of hs) {
      if (h.pidx >= 0) continue;
      const pick = sorted.find((q) => !taken.has(q.id));
      if (pick) { h.pidx = pick.id; taken.add(pick.id); h.lock = 0.45; }
    }
    for (const h of hs) if (h.pidx >= 0) m.players[h.pidx].human = h.id;
  }
}

const SPEED = 6.4; const SPRINT = 8.6;

function act(m: Match, p: Player, it: Intent, dt: number): void {
  const b = m.ball;
  const hasBall = b.owner === p.id;
  p.cool = Math.max(0, p.cool - dt); p.tcool = Math.max(0, p.tcool - dt); p.stun = Math.max(0, p.stun - dt);

  // slide tackle
  if (it.tackle && p.tcool <= 0 && p.tack <= 0 && p.stun <= 0 && !hasBall) { p.tack = 0.34; p.tackUsed = false; p.tcool = 1; }
  if (p.tack > 0) {
    p.tack -= dt;
    p.vx = Math.cos(p.ang) * 10.5; p.vy = Math.sin(p.ang) * 10.5;
    const o = b.owner >= 0 ? m.players[b.owner] : null;
    if (!p.tackUsed && o && o.team !== p.team && dist(p.x, p.y, o.x, o.y) < 1.4) {
      p.tackUsed = true;
      if (Math.random() < (p.human >= 0 ? 0.62 : 0.5)) { b.owner = p.id; b.last = p.team; o.stun = 0.7; o.cool = 0.3; p.tack = 0; p.cool = 0; }
      else { p.stun = 0.6; p.tack = 0; }
    } else if (p.tack <= 0 && !p.tackUsed) p.stun = 0.45;
    p.x += p.vx * dt; p.y += p.vy * dt;
    return;
  }

  // running
  let maxSp = (it.sp && p.stam > 0.04 ? SPRINT : SPEED) * (hasBall ? 0.93 : 1) * (p.stun > 0 ? 0.3 : 1) * (p.human < 0 ? (p.role === 'gk' ? 0.85 : 0.97) : 1);
  if (m.phase === 'goal' || m.phase === 'end' || m.phase === 'kickoff') maxSp = 0;
  const mag = Math.min(1, Math.hypot(it.mx, it.my));
  const dx = mag > 0 ? (it.mx / Math.hypot(it.mx, it.my)) * maxSp * mag : 0;
  const dy = mag > 0 ? (it.my / Math.hypot(it.mx, it.my)) * maxSp * mag : 0;
  const acc = 34 * dt;
  const ex = dx - p.vx; const ey = dy - p.vy; const el = Math.hypot(ex, ey);
  if (el > acc) { p.vx += (ex / el) * acc; p.vy += (ey / el) * acc; } else { p.vx = dx; p.vy = dy; }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0.6) {
    const want = Math.atan2(p.vy, p.vx);
    let da = want - p.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    p.ang += da * Math.min(1, 14 * dt);
  }
  if (it.sp && mag > 0.2 && p.stam > 0.04) p.stam = Math.max(0, p.stam - 0.26 * dt); else p.stam = Math.min(1, p.stam + 0.12 * dt);
  p.anim += sp * 1.6 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;

  if (m.phase === 'goal' || m.phase === 'end' || m.phase === 'kickoff') return;
  if (hasBall && it.pass) doPass(m, p, it);
  else if (hasBall && it.shoot) doShoot(m, p, it);
  else if (!hasBall && it.pass && p.cool <= 0 && b.owner < 0 && dist(p.x, p.y, b.x, b.y) < 1.6) doPass(m, p, it);
  else if (!hasBall && it.shoot && p.cool <= 0 && b.owner < 0 && dist(p.x, p.y, b.x, b.y) < 1.6) doShoot(m, p, it);
}

function separate(m: Match): void {
  const ps = m.players;
  for (let i = 0; i < ps.length; i += 1) {
    for (let j = i + 1; j < ps.length; j += 1) {
      const a = ps[i]; const c = ps[j];
      const dx = c.x - a.x; const dy = c.y - a.y; const d = Math.hypot(dx, dy);
      if (d < 0.9 && d > 0.001) { const push = (0.9 - d) / 2; a.x -= (dx / d) * push; a.y -= (dy / d) * push; c.x += (dx / d) * push; c.y += (dy / d) * push; }
    }
    ps[i].x = clamp(ps[i].x, -2, L + 2); ps[i].y = clamp(ps[i].y, -1.5, W + 1.5);
  }
}

function updateBall(m: Match, dt: number): void {
  const b = m.ball;
  if (b.owner >= 0) {
    const p = m.players[b.owner];
    const tx = p.x + Math.cos(p.ang) * 0.8; const ty = p.y + Math.sin(p.ang) * 0.8;
    const k = Math.min(1, 16 * dt);
    b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.vx = p.vx; b.vy = p.vy; b.last = p.team;
    return;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
  const f = Math.exp(-0.58 * dt);
  b.vx *= f; b.vy *= f;
  if (Math.hypot(b.vx, b.vy) < 0.12) { b.vx = 0; b.vy = 0; }

  // who gets the ball
  let best: Player | null = null; let bd = 99;
  for (const p of m.players) {
    if (p.cool > 0 || p.stun > 0 || p.tack > 0) continue;
    if (m.phase === 'restart' && p.team !== m.restart.team) continue;
    if (m.phase !== 'play' && m.phase !== 'restart') continue;
    const d = dist(p.x, p.y, b.x, b.y);
    const reach = p.role === 'gk' ? 1.7 : 1.05;
    if (d > reach) continue;
    const rel = Math.hypot(b.vx - p.vx, b.vy - p.vy);
    if (p.role === 'gk') {
      if (rel > 13) { // a shot: catch it or push it away
        if (Math.random() < clamp(0.9 - rel / 26, 0.12, 0.55)) { best = p; bd = d; break; }
        b.vx = -b.vx * 0.35 + rnd(-4, 4); b.vy = b.vy * 0.5 + rnd(-6, 6); p.cool = 0.45; b.last = p.team; continue;
      }
    } else if (rel > 19) { continue; }
    else if (rel > 14 && p.team !== b.last && Math.random() < 0.4) { // a body in the way
      b.vx *= 0.4; b.vy = b.vy * 0.4 + rnd(-5, 5); p.cool = 0.3; b.last = p.team; continue;
    }
    if (d < bd) { bd = d; best = p; }
  }
  if (best) {
    b.owner = best.id; b.last = best.team; b.vx = best.vx; b.vy = best.vy;
    if (m.phase === 'restart') { m.phase = 'play'; m.phaseT = 0; }
  }
}

function checkBounds(m: Match): void {
  const b = m.ball;
  if (m.phase !== 'play') return;
  const inMouth = Math.abs(b.y - W / 2) < GOAL_W / 2;
  if ((b.x < 0 || b.x > L) && inMouth) {
    const scorer: Team = b.x < 0 ? 1 : 0;
    m.score[scorer] += 1; m.scorer = scorer; m.phase = 'goal'; m.phaseT = 0;
    b.owner = -1; b.vx *= 0.15; b.vy *= 0.15; b.x = clamp(b.x, -GOAL_D + 0.3, L + GOAL_D - 0.3);
    return;
  }
  if (b.owner >= 0 && (b.x >= 0 && b.x <= L && b.y >= 0 && b.y <= W)) return;
  if (b.owner >= 0) { // the carrier walked off: counts as out
    const last = b.last;
    b.vx = 0; b.vy = 0;
    restartFrom(m, b, last);
    return;
  }
  if (b.x < 0 || b.x > L || b.y < 0 || b.y > W) restartFrom(m, b, b.last);
}

function restartFrom(m: Match, b: Ball, last: Team): void {
  let team: Team; let x: number; let y: number;
  if (b.x < 0 || b.x > L) {
    const endTeam: Team = b.x < 0 ? 0 : 1; // the team defending that end
    if (last === endTeam) { team = endTeam === 0 ? 1 : 0; x = b.x < 0 ? 0.5 : L - 0.5; y = b.y < W / 2 ? 0.5 : W - 0.5; }
    else { team = endTeam; x = b.x < 0 ? 6 : L - 6; y = W / 2; }
  } else {
    team = last === 0 ? 1 : 0; x = clamp(b.x, 2, L - 2); y = b.y < 0 ? 0.4 : W - 0.4;
  }
  m.restart = { team, x, y }; m.phase = 'restart'; m.phaseT = 0;
  b.owner = -1; b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.last = team;
  for (const p of m.players) { p.tack = 0; p.cool = 0; }
}

/** One slice of game time (use about 1/60 s). cmds holds what each person is pressing, keyed by their id. */
export function step(m: Match, dt: number, cmds: Record<number, Cmd>): void {
  if (m.phase === 'end') return;
  m.phaseT += dt;
  if (m.phase === 'kickoff') {
    if (m.phaseT > 1.6) { m.phase = 'play'; m.phaseT = 0; }
  } else if (m.phase === 'goal') {
    if (m.phaseT > 3.2) startKickoff(m, m.scorer === 0 ? 1 : 0);
  } else {
    m.clock += dt;
    if (m.clock >= m.duration) { m.clock = m.duration; m.phase = 'end'; m.phaseT = 0; m.ball.vx = 0; m.ball.vy = 0; }
    if (m.phase === 'restart' && m.phaseT > 5) { // nobody took it: give it to the closest player
      let best: Player | null = null; let bd = 999;
      for (const p of m.players) if (p.team === m.restart.team) { const d = dist(p.x, p.y, m.ball.x, m.ball.y); if (d < bd) { bd = d; best = p; } }
      if (best) { best.x = m.ball.x; best.y = m.ball.y; m.ball.owner = best.id; m.phase = 'play'; m.phaseT = 0; }
    }
  }
  assignHumans(m, dt, cmds);
  for (const p of m.players) {
    let it: Intent;
    if (p.human >= 0) {
      const h = m.humans.find((x) => x.id === p.human);
      it = h ? humanIntent(m, p, h, cmds[h.id] ?? NO_CMD, dt) : idle();
    } else it = p.role === 'gk' ? aiKeeper(m, p, dt) : aiField(m, p, dt);
    act(m, p, it, dt);
  }
  // people who control nobody (for example a goalkeeper-only side) still need their buttons tracked
  for (const h of m.humans) if (h.pidx < 0) { const c = cmds[h.id] ?? NO_CMD; h.prevA = c.a; h.prevB = c.b; }
  separate(m);
  updateBall(m, dt);
  checkBounds(m);
}
