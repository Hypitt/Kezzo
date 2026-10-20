import { supabase } from './supabase';

/**
 * Anonymous usage statistics for the Kezzo team (see the Privacy Policy).
 * - A random id kept on this device tells visitors apart; it holds no personal data.
 * - Pages are reported as patterns (/battles/:id), never with the real ids.
 * - Nothing is sent when the browser says "Do Not Track" or "Global Privacy Control".
 * Failures are always silent: statistics must never get in the way of the app.
 */
type Kind = 'pageview' | 'signin' | 'signup' | 'signout' | 'perf' | 'error';
interface Ev { kind: Kind; path?: string; referrer?: string; value?: number; detail?: string }

const queue: Ev[] = [];
let timer: number | undefined;
let errors = 0;

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

function randomId(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function stored(area: 'local' | 'session', key: string): string {
  try {
    const s = area === 'local' ? localStorage : sessionStorage;
    let v = s.getItem(key);
    if (!v) {
      v = randomId();
      s.setItem(key, v);
    }
    return v;
  } catch {
    return randomId();
  }
}

async function flush(): Promise<void> {
  timer = undefined;
  const events = queue.splice(0, 10);
  if (events.length === 0) return;
  if (queue.length > 0) timer = window.setTimeout(() => void flush(), 500);
  try {
    const { data } = await supabase.auth.getSession();
    await fetch('/api/track', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        visitor: stored('local', 'kezzo_vid'),
        session: stored('session', 'kezzo_sid'),
        lang: document.documentElement.lang || undefined,
        token: data.session?.access_token,
      }),
    });
  } catch {
    /* offline or blocked: ignore */
  }
}

export function track(ev: Ev): void {
  if (optedOut() || queue.length > 40) return;
  queue.push(ev);
  if (timer === undefined) timer = window.setTimeout(() => void flush(), 800);
}

/** Turns "/battles/3f2a…" into "/battles/:id" so no identifier ever leaves the browser. */
export function pagePattern(hash: string): string {
  const [tab, id] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (!tab) return '/search';
  if (tab === 'legal') return `/legal/${id === 'privacy' ? 'privacy' : 'terms'}`;
  if (tab === 'join') return '/join/:code';
  return id ? `/${tab}/:id` : `/${tab}`;
}

let lastPage = '';
export function trackPage(hash: string): void {
  const path = pagePattern(hash);
  if (path === lastPage || path.startsWith('/admin')) return;
  const first = lastPage === '';
  lastPage = path;
  track({ kind: 'pageview', path, referrer: first ? document.referrer : undefined });
}

/** Page load time once per visit, plus a few JavaScript errors (message only, no personal data). */
export function startMonitoring(): void {
  if (optedOut()) return;
  const report = () => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.loadEventEnd > 0) track({ kind: 'perf', value: nav.loadEventEnd, path: pagePattern(window.location.hash) });
  };
  if (document.readyState === 'complete') window.setTimeout(report, 0);
  else window.addEventListener('load', () => window.setTimeout(report, 0), { once: true });

  const fail = (msg: string) => {
    if (errors >= 5 || !msg || msg === 'Script error.') return;
    errors += 1;
    track({ kind: 'error', detail: msg.slice(0, 160), path: pagePattern(window.location.hash) });
  };
  window.addEventListener('error', (e) => fail(e.message));
  window.addEventListener('unhandledrejection', (e) => fail(String((e.reason as Error | undefined)?.message ?? e.reason ?? '')));
}
