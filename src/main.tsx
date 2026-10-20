import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenForInstall } from './lib/pwa';
import './index.css';

listenForInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app + fast reopen. Only on the published site: in development it would cache files you are editing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
