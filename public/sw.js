/*
 * Kezzo service worker: makes Kezzo installable and fast to reopen, while keeping storage small.
 *
 *   App pages  → network first (always the newest version), saved copy when offline
 *   App files  → /assets/* never change once published, so they are served from the cache
 *   Fonts      → cached, refreshed in the background
 *   Everything else (Supabase data, sign-in, uploads, live video, /api) → never cached, always live
 *
 * Bump VERSION when this file changes in a way that needs old caches cleared.
 */
const VERSION = 'v1';
const SHELL = `kezzo-shell-${VERSION}`;
const ASSETS = `kezzo-assets-${VERSION}`;
const FONTS = `kezzo-fonts-${VERSION}`;
const KEEP = [SHELL, ASSETS, FONTS];
const MAX_ASSETS = 80; // older app files are removed past this, so the cache never grows without limit
const SHELL_FILES = ['/', '/manifest.webmanifest', '/favicon.svg', '/logo-white.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kezzo-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page loads: newest version from the network; the saved app shell when offline.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)) ),
    );
    return;
  }

  // Built app files have a content hash in their name: safe to serve from the cache forever.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          trim(ASSETS, MAX_ASSETS);
        }
        return res;
      }),
    );
    return;
  }

  // Small static files (icons, logo, manifest): cache, refresh in the background.
  if (url.origin === self.location.origin && SHELL_FILES.includes(url.pathname) && url.pathname !== '/') {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }

  // Google Fonts: cached so text looks right offline and loads instantly next time.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || fresh;
      }),
    );
  }
  // Anything else (Supabase, LiveKit, /api, uploads, media): not handled, goes straight to the network.
});
