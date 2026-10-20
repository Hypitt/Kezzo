import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../state/I18n';

/**
 * Catches a crash inside one page so the rest of Kezzo (navbar, other pages) keeps working.
 * Without this, any error while rendering a page turns the whole app into a blank white screen.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page crashed', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }): void {
    // Moving to another page clears the error.
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render(): ReactNode {
    return this.state.failed ? <PageError /> : this.props.children;
  }
}

function PageError() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-sm space-y-3 py-16 text-center">
      <p className="text-sm text-zinc-600">{t('page_error')}</p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>{t('reload_page')}</button>
    </div>
  );
}

const RELOAD_KEY = 'kezzo_chunk_reload';

/**
 * After a new version is deployed, a tab that was already open asks for page files that no longer exist.
 * Reload once to get the new version instead of showing an error; never loop.
 */
export function loadPage<T>(load: () => Promise<T>): Promise<T> {
  return load().then(
    (mod) => {
      try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* storage blocked */ }
      return mod;
    },
    (err: unknown) => {
      const message = String((err as { message?: string })?.message ?? err);
      const stale = /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError|error loading dynamically/i.test(message);
      let reloadedRecently = false;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        reloadedRecently = Date.now() - last < 30_000;
        if (stale && !reloadedRecently) sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch { /* storage blocked */ }
      if (stale && !reloadedRecently) {
        window.location.reload();
        return new Promise<T>(() => undefined); // keep showing the spinner while the page reloads
      }
      throw err;
    },
  );
}
