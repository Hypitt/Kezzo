/** Reloads the page once when a lazy-loaded page file is missing (this happens in tabs left open across a new deployment). */
const FLAG = 'kezzo_reloaded_at';

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(FLAG) ?? 0);
    if (Date.now() - last < 30_000) return false; // just reloaded: do not loop
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch { /* private mode: reload anyway, once per call */ }
  window.location.reload();
  return true;
}

export function isStaleChunkError(err: unknown): boolean {
  const msg = String((err as { message?: string } | undefined)?.message ?? err ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}

export function setupStaleReload(): void {
  // Vite fires this when a preloaded chunk cannot be fetched.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isStaleChunkError(e.reason) && reloadOnce()) e.preventDefault();
  });
}
