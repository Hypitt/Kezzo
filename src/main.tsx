import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initInstall } from './lib/install';
import { setupStaleReload } from './lib/reload';

initInstall();

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
