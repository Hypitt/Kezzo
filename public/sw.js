/* Kezzo service worker: makes the site installable as an app. It does not cache anything,
   so people always get the latest version and nothing can go stale. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* network as usual */ });
