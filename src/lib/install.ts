import { useEffect, useState } from 'react';

/**
 * "Install the app" support (a web app, no app store). Chrome, Edge and Android browsers send a `beforeinstallprompt`
 * event that we keep until the person presses our Install button. Safari on iPhone/iPad has no such event, so we show
 * short instructions instead (Share, then Add to Home Screen).
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

/** Called once at startup (main.tsx), before the page finishes loading, so the browser event is not missed. */
export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    notify();
  });
}

/** True when Kezzo is already running as an installed app (home screen icon or app window). */
export function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const alreadyInstalled = installed || isStandalone();
  /** Opens the browser's own install window when it is available; returns false when instructions must be shown instead. */
  const install = async (): Promise<boolean> => {
    if (!deferred) return false;
    const ev = deferred;
    deferred = null;
    notify();
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch { /* closed without choosing */ }
    return true;
  };
  return { installed: alreadyInstalled, canPrompt: deferred !== null, ios: isIos(), install };
}
