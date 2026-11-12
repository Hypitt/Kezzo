import type { Cmd } from './engine';

export interface KeyMap { up: string[]; down: string[]; left: string[]; right: string[]; pass: string[]; shoot: string[]; sprint: string[] }
export const MAP_P1: KeyMap = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], pass: ['KeyF'], shoot: ['KeyG'], sprint: ['KeyR'] };
export const MAP_P2: KeyMap = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], pass: ['Comma'], shoot: ['Period'], sprint: ['Slash'] };
export const MAP_ANY: KeyMap = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  pass: ['KeyF', 'KeyZ', 'Space'], shoot: ['KeyG', 'KeyX', 'Enter'], sprint: ['KeyR', 'KeyC', 'ShiftLeft', 'ShiftRight'],
};
const ALL = new Set([...Object.values(MAP_P1).flat(), ...Object.values(MAP_P2).flat(), ...Object.values(MAP_ANY).flat()]);

/** Listens to the keyboard while a match is on screen. */
export class Keys {
  private down = new Set<string>();
  private kd = (e: KeyboardEvent) => { if (ALL.has(e.code)) { e.preventDefault(); this.down.add(e.code); } };
  private ku = (e: KeyboardEvent) => { this.down.delete(e.code); };
  private blur = () => { this.down.clear(); };
  attach(): void { window.addEventListener('keydown', this.kd); window.addEventListener('keyup', this.ku); window.addEventListener('blur', this.blur); }
  detach(): void { window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku); window.removeEventListener('blur', this.blur); this.down.clear(); }
  read(map: KeyMap): Cmd {
    const on = (codes: string[]) => codes.some((c) => this.down.has(c));
    const mx = (on(map.right) ? 1 : 0) - (on(map.left) ? 1 : 0);
    const my = (on(map.down) ? 1 : 0) - (on(map.up) ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    return { mx: mx / len, my: my / len, sp: on(map.sprint), a: on(map.pass), b: on(map.shoot) };
  }
}

/** Two sources of the same person's controls (keyboard and touch): the stick of whichever is in use, buttons from either. */
export function mergeCmd(a: Cmd, b: Cmd): Cmd {
  const useA = Math.hypot(a.mx, a.my) > 0.05;
  return { mx: useA ? a.mx : b.mx, my: useA ? a.my : b.my, sp: a.sp || b.sp, a: a.a || b.a, b: a.b || b.b };
}
