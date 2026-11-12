import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Cmd } from '../../game/football/engine';

const R = 52; // stick travel in pixels

/** An on-screen stick and three buttons: pass, shoot, sprint. */
export function TouchPad({ side, color, labels, onChange }: { side: 'left' | 'right' | 'all'; color: string; labels: { pass: string; shoot: string; sprint: string }; onChange: (c: Cmd) => void }) {
  const cmd = useRef<Cmd>({ mx: 0, my: 0, sp: false, a: false, b: false });
  const base = useRef<HTMLDivElement>(null);
  const stickId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const push = () => onChange({ ...cmd.current });

  const move = (e: RPointerEvent) => {
    const r = base.current?.getBoundingClientRect(); if (!r) return;
    let dx = e.clientX - (r.left + r.width / 2); let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    setKnob({ x: dx, y: dy });
    cmd.current.mx = dx / R; cmd.current.my = dy / R; push();
  };
  const stick = {
    onPointerDown: (e: RPointerEvent) => { stickId.current = e.pointerId; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e); },
    onPointerMove: (e: RPointerEvent) => { if (stickId.current === e.pointerId) move(e); },
    onPointerUp: (e: RPointerEvent) => { if (stickId.current === e.pointerId) { stickId.current = null; setKnob({ x: 0, y: 0 }); cmd.current.mx = 0; cmd.current.my = 0; push(); } },
  };
  const btn = (key: 'a' | 'b' | 'sp', text: string, size: string) => (
    <button type="button" aria-label={text}
      className={`flex select-none items-center justify-center rounded-full border-2 border-white/70 text-[11px] font-bold text-white shadow-lg ${size}`}
      style={{ background: `${color}cc`, touchAction: 'none' }}
      onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); cmd.current[key] = true; push(); }}
      onPointerUp={() => { cmd.current[key] = false; push(); }}
      onPointerCancel={() => { cmd.current[key] = false; push(); }}>{text}</button>
  );
  const stickEl = (
    <div ref={base} {...stick} className="relative h-32 w-32 shrink-0 rounded-full border-2 border-white/50 bg-white/15" style={{ touchAction: 'none' }} aria-label="Move">
      <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-white/80" style={{ background: `${color}dd`, transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
    </div>
  );
  const buttons = (
    <div className="flex items-end gap-2">
      {btn('sp', labels.sprint, 'h-12 w-12')}{btn('a', labels.pass, 'h-14 w-14')}{btn('b', labels.shoot, 'h-16 w-16')}
    </div>
  );
  if (side === 'all') {
    return (
      <>
        <div className="absolute bottom-3 left-3 z-10">{stickEl}</div>
        <div className="absolute bottom-4 right-3 z-10">{buttons}</div>
      </>
    );
  }
  const col = (
    <div className="flex flex-col items-center gap-2">
      {btn('b', labels.shoot, 'h-12 w-12')}{btn('a', labels.pass, 'h-12 w-12')}{btn('sp', labels.sprint, 'h-10 w-10')}
    </div>
  );
  return side === 'left'
    ? <div className="absolute bottom-3 left-3 z-10 flex items-end gap-2">{stickEl}{col}</div>
    : <div className="absolute bottom-3 right-3 z-10 flex items-end gap-2">{col}{stickEl}</div>;
}
