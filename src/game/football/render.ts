import { GOAL_D, GOAL_W, L, W } from './engine';
import { F_STUN, F_TACKLE, type View } from './view';

export interface Camera { x: number; y: number; ready: boolean }
export const newCamera = (): Camera => ({ x: L / 2, y: W / 2, ready: false });

export interface Ring { pidx: number; color: string; label: string }
export interface Words { teams: [string, string]; kickoff: string; goal: string; fullTime: string; throwIn: string }

const SKIN = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#6b4226', '#f5d5b8'];
const HAIR = ['#1b1b1b', '#3b2417', '#6a4a2a', '#c9a227', '#7a2b1a', '#1b1b1b', '#8a8a8a'];
const KIT: Array<{ shirt: string; shorts: string; keeper: string }> = [
  { shirt: '#f97316', shorts: '#ffffff', keeper: '#16a34a' },
  { shirt: '#2563eb', shorts: '#0f172a', keeper: '#eab308' },
];

/** Keeps each footballer's running stride between frames. */
export class Animator {
  private phase: number[] = [];
  tick(i: number, speed: number, dt: number): number {
    this.phase[i] = (this.phase[i] ?? i * 1.7) + speed * 1.6 * dt;
    return this.phase[i];
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, phase: number, speed: number, team: 0 | 1, keeper: boolean, idx: number, flags: number): void {
  const k = 1.5;
  const kit = KIT[team];
  const shirt = keeper ? kit.keeper : kit.shirt;
  const skin = SKIN[(idx * 5 + 2) % SKIN.length];
  const hair = HAIR[(idx * 3 + team) % HAIR.length];
  const run = Math.min(1, speed / 5);
  const sw = Math.sin(phase) * 0.46 * run * k;
  const down = (flags & F_STUN) !== 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, 0.12, 0.14, 0.85 * k, 0.6 * k);
  ctx.rotate(ang);
  if (flags & F_TACKLE) { // sliding: legs stretched out in front
    ctx.fillStyle = kit.shorts; ellipse(ctx, 0.45 * k, -0.14 * k, 0.55 * k, 0.15 * k); ellipse(ctx, 0.5 * k, 0.16 * k, 0.5 * k, 0.15 * k);
    ctx.fillStyle = '#111827'; ellipse(ctx, 0.95 * k, -0.14 * k, 0.15 * k, 0.12 * k); ellipse(ctx, 0.95 * k, 0.16 * k, 0.15 * k, 0.12 * k);
  } else {
    ctx.fillStyle = kit.shorts; ellipse(ctx, sw, -0.2 * k, 0.3 * k, 0.16 * k); ellipse(ctx, -sw, 0.2 * k, 0.3 * k, 0.16 * k);
    ctx.fillStyle = '#111827'; ellipse(ctx, sw + 0.26 * k, -0.2 * k, 0.15 * k, 0.12 * k); ellipse(ctx, -sw + 0.26 * k, 0.2 * k, 0.15 * k, 0.12 * k);
  }
  // arms swing against the legs
  const as = -Math.sin(phase) * 0.34 * run * k;
  ctx.fillStyle = shirt; ellipse(ctx, as * 0.6, -0.56 * k, 0.2 * k, 0.12 * k); ellipse(ctx, -as * 0.6, 0.56 * k, 0.2 * k, 0.12 * k);
  ctx.fillStyle = skin; ellipse(ctx, as * 0.6 + 0.2 * k, -0.58 * k, 0.1 * k, 0.09 * k); ellipse(ctx, -as * 0.6 + 0.2 * k, 0.58 * k, 0.1 * k, 0.09 * k);
  // body and head
  ctx.fillStyle = shirt; ellipse(ctx, 0, 0, 0.3 * k, 0.5 * k);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(0, 0, 0.3 * k, 0.5 * k, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = skin; ellipse(ctx, 0.05 * k, 0, 0.27 * k, 0.27 * k);
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(0.02 * k, 0, 0.28 * k, Math.PI * 0.45, Math.PI * 1.55); ctx.fill();
  if (down) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ellipse(ctx, 0, 0, 0.8 * k, 0.8 * k); }
  ctx.restore();
}

function drawPitch(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 14; i += 1) { ctx.fillStyle = i % 2 ? '#2e9a40' : '#37a84a'; ctx.fillRect((L / 14) * i, 0, L / 14 + 0.05, W); }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 0.18; ctx.lineJoin = 'round';
  ctx.strokeRect(0, 0, L, W);
  ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.lineTo(L / 2, W); ctx.stroke();
  ctx.beginPath(); ctx.arc(L / 2, W / 2, 9.15, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(L / 2, W / 2, 0.3, 0, Math.PI * 2); ctx.fill();
  for (const left of [true, false]) {
    const x0 = left ? 0 : L; const s = left ? 1 : -1;
    ctx.strokeRect(left ? 0 : L - 16.5, W / 2 - 20.15, 16.5, 40.3);
    ctx.strokeRect(left ? 0 : L - 5.5, W / 2 - 9.16, 5.5, 18.32);
    ctx.beginPath(); ctx.arc(x0 + s * 11, W / 2, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x0 + s * 11, W / 2, 9.15, s > 0 ? -0.93 : Math.PI - 0.93 + 0.0, s > 0 ? 0.93 : Math.PI + 0.93); ctx.stroke();
    // goal with net
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(left ? -GOAL_D : L, W / 2 - GOAL_W / 2, GOAL_D, GOAL_W);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.05;
    for (let g = 0; g <= GOAL_W; g += 0.61) { ctx.beginPath(); ctx.moveTo(left ? -GOAL_D : L, W / 2 - GOAL_W / 2 + g); ctx.lineTo(left ? 0 : L + GOAL_D, W / 2 - GOAL_W / 2 + g); ctx.stroke(); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.22;
    ctx.strokeRect(left ? -GOAL_D : L, W / 2 - GOAL_W / 2, GOAL_D, GOAL_W);
    ctx.lineWidth = 0.18;
  }
  for (const cx of [0, L]) for (const cy of [0, W]) { ctx.beginPath(); ctx.arc(cx, cy, 1, 0, Math.PI * 2); ctx.stroke(); }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, x + 0.15, y + 0.18, 0.5, 0.36);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 0.46, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 0.07; ctx.stroke();
  ctx.fillStyle = '#111827';
  for (let i = 0; i < 3; i += 1) { const a = spin + (i * Math.PI * 2) / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, 0.1, 0, Math.PI * 2); ctx.fill(); }
}

/** Draws the whole scene. The camera follows the ball. */
export function draw(ctx: CanvasRenderingContext2D, w: number, h: number, v: View, cam: Camera, anim: Animator, dt: number, rings: Ring[], words: Words, ui = 1): void {
  const s = (w > h ? h / 30 : w / 32);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1f6d2c'; ctx.fillRect(0, 0, w, h);
  const hw = w / (2 * s); const hh = h / (2 * s);
  const tx = v.ball.x; const ty = v.ball.y;
  if (!cam.ready) { cam.x = tx; cam.y = ty; cam.ready = true; }
  const k = Math.min(1, 4.5 * dt);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
  cam.x = hw * 2 < L + 10 ? Math.max(hw - 5, Math.min(L + 5 - hw, cam.x)) : L / 2;
  cam.y = hh * 2 < W + 8 ? Math.max(hh - 4, Math.min(W + 4 - hh, cam.y)) : W / 2;
  ctx.setTransform(s, 0, 0, s, w / 2 - cam.x * s, h / 2 - cam.y * s);
  drawPitch(ctx);

  const order = v.players.map((_, i) => i).sort((a, c) => v.players[a].y - v.players[c].y);
  for (const i of order) {
    const p = v.players[i];
    const ring = rings.find((r) => r.pidx === i);
    if (ring) { ctx.strokeStyle = ring.color; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, 1.25, 0, Math.PI * 2); ctx.stroke(); }
    drawPlayer(ctx, p.x, p.y, p.ang, anim.tick(i, p.sp, dt), p.sp, p.team, p.role === 'gk', i % v.n, p.flags);
  }
  drawBall(ctx, v.ball.x, v.ball.y, v.ball.x * 0.9 + v.ball.y * 0.5);
  for (const r of rings) {
    const p = v.players[r.pidx]; if (!p) continue;
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 1.55); ctx.lineTo(p.x - 0.55, p.y - 2.3); ctx.lineTo(p.x + 0.55, p.y - 2.3); ctx.closePath(); ctx.fill();
    if (r.label) { ctx.font = 'bold 1.1px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 0.22; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(r.label, p.x, p.y - 2.6); ctx.fillStyle = '#ffffff'; ctx.fillText(r.label, p.x, p.y - 2.6); }
  }

  // scoreboard and messages, in screen pixels
  ctx.setTransform(ui, 0, 0, ui, 0, 0);
  const cw = w / ui; const ch = h / ui;
  const minute = Math.min(90, Math.floor((v.clock / v.duration) * 90));
  const bw = Math.min(cw - 16, 360); const bx = (cw - bw) / 2;
  ctx.fillStyle = 'rgba(15,23,42,0.82)';
  ctx.beginPath(); ctx.roundRect(bx, 8, bw, 34, 10); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left'; ctx.fillStyle = KIT[0].shirt; ctx.fillText(words.teams[0], bx + 12, 25);
  ctx.textAlign = 'right'; ctx.fillStyle = '#93c5fd'; ctx.fillText(words.teams[1], bx + bw - 12, 25);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff'; ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText(`${v.score[0]}  -  ${v.score[1]}`, cw / 2, 24);
  ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = '#cbd5e1'; ctx.fillText(`${minute}'`, cw / 2, 52);
  const banner = v.phase === 'kickoff' ? words.kickoff : v.phase === 'goal' ? words.goal : v.phase === 'end' ? words.fullTime : v.phase === 'restart' && v.phaseT < 1.2 ? words.throwIn : '';
  if (banner) {
    ctx.font = '800 34px system-ui, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(15,23,42,0.85)'; ctx.fillStyle = '#ffffff';
    ctx.strokeText(banner, cw / 2, ch * 0.3); ctx.fillText(banner, cw / 2, ch * 0.3);
  }
}

