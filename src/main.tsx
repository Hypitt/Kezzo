import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initInstall } from './lib/install';
import { setupStaleReload } from './lib/reload';
import { initTheme } from './lib/theme';

initInstall();
initTheme();

// Open the connections to the database and to the media store early, so the first requests (sign-in, feed, videos) start sooner.
for (const url of [import.meta.env.VITE_SUPABASE_URL as string | undefined, import.meta.env.VITE_R2_PUBLIC_URL as string | undefined]) {
  try {
    if (!url) continue;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = new URL(url).origin;
    link.crossOrigin = '';
    document.head.appendChild(link);
  } catch { /* a missing or odd address only skips this speed-up */ }
}

// A new version was deployed while this tab was open: the page files it asks for no longer exist.
// Reload once to pick up the new version (a flag stops it from looping if something else is wrong).
setupStaleReload();
// Lets the browser offer "Install app". The worker caches nothing (see public/sw.js).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
