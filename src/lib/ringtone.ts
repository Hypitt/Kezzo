/**
 * A phone-style ringtone made with the browser's own audio engine (no sound files to download).
 * Browsers only allow sound after the person has touched the page once, so `unlockAudio` listens for the first tap or key press.
 */
let ctx: AudioContext | null = null;
let timer: number | undefined;
let playing = false;

function context(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { ctx = null; }
  return ctx;
}

/** Call once at startup: the first tap or key press prepares the audio engine so a later incoming call can ring. */
export function unlockAudio(): void {
  const prepare = () => {
    const c = context();
    if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  };
  for (const type of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(type, prepare, { once: true, passive: true });
}

/** One "ring-ring": two short double beeps. */
function burst(c: AudioContext) {
  const start = c.currentTime + 0.02;
  for (const offset of [0, 0.5]) {
    for (const freq of [440, 480]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + offset);
      gain.gain.linearRampToValueAtTime(0.18, start + offset + 0.04);
      gain.gain.setValueAtTime(0.18, start + offset + 0.36);
      gain.gain.linearRampToValueAtTime(0, start + offset + 0.42);
      osc.connect(gain).connect(c.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.45);
    }
  }
}

export function startRingtone(): void {
  if (playing) return;
  playing = true;
  const c = context();
  const ring = () => {
    if (c && c.state === 'running') burst(c);
    try { navigator.vibrate?.([400, 200, 400]); } catch { /* not supported */ }
  };
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
  ring();
  timer = window.setInterval(ring, 3000);
}

export function stopRingtone(): void {
  playing = false;
  window.clearInterval(timer);
  try { navigator.vibrate?.(0); } catch { /* not supported */ }
}
