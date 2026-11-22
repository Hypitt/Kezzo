import { supabase } from './supabase';

const SENT = 'kezzo.installSent';
const EVENT = 'kezzo.installEvent';

/** True when Kezzo runs as an installed app (home-screen icon or native app), not as a normal browser tab. */
export function isInstalledApp(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
    return localStorage.getItem(EVENT) === '1';
  } catch { return false; }
}

/** The browser tells us when the person installs the app from the browser. */
export function watchInstallEvent(): void {
  window.addEventListener('appinstalled', () => { try { localStorage.setItem(EVENT, '1'); } catch { /* ignore */ } });
}

/** A one-way code for this phone, made of settings that stay the same after the app is deleted and installed again. Only the hash leaves the phone. */
async function deviceCode(): Promise<string> {
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch { /* no WebGL */ }
  const nav = navigator as Navigator & { deviceMemory?: number };
  const dims = [Math.min(screen.width, screen.height), Math.max(screen.width, screen.height)].join('x');
  const raw = [nav.platform, dims, window.devicePixelRatio, nav.hardwareConcurrency, nav.deviceMemory ?? '', nav.maxTouchPoints, Intl.DateTimeFormat().resolvedOptions().timeZone, gpu, screen.colorDepth].join('|');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kezzo-device-v1|${raw}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Called once the person is signed in: if this is the installed app, tell the server (it counts only a device's first install). */
export async function recordInstall(): Promise<void> {
  try {
    if (!isInstalledApp() || localStorage.getItem(SENT) === '1') return;
    const { error } = await supabase.rpc('record_install', { p_device: await deviceCode(), p_source: 'web' });
    if (!error) localStorage.setItem(SENT, '1');
  } catch { /* try again next time */ }
}
