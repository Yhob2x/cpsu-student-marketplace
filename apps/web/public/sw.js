/* Offline shell only. No API requests, user data, or personalized pages are cached. */
const CACHE_NAME = 'cpsu-offline-shell-v3';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith('cpsu-offline-shell-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  // Never serve a stale cached app HTML shell when JavaScript assets are unavailable.
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
    return (await caches.match(OFFLINE_URL)) || Response.error();
  }));
});

/* Background alerts are private: the server sends only generic event descriptions.
 * No credentials, message bodies, names, or user data are cached in this worker. */
const pushRoute = (value) => {
  if (typeof value !== 'string') return '/notifications';
  return /^\/(inquiries\/[1-9]\d*|listings\/[1-9]\d*|transactions\/[1-9]\d*|notifications|profile)$/.test(value)
    ? value : '/notifications';
};

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let detail = {};
    try { detail = event.data ? event.data.json() : {}; } catch { /* Use generic fallback. */ }
    const url = pushRoute(detail.url);
    const unread = Number.isSafeInteger(detail.unread) ? Math.max(0, detail.unread) : null;
    const allowedBodies = new Set([
      'You have a new marketplace inquiry.', 'You have a new message.',
      'Your listing was approved.', 'Your listing has a review update.',
      'A listing needs your attention.', 'Your CPSU account verification has an update.',
      'A store you follow has published a new listing.',
      'A student sent you a purchase or service request.',
      'The other student updated your transaction.',
    ]);
    await self.registration.showNotification('CPSU Market', {
      body: allowedBodies.has(detail.body) ? detail.body : 'You have a new marketplace update.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-maskable-192.png',
      tag: typeof detail.tag === 'string' && /^cpsu-\d+$/.test(detail.tag) ? detail.tag : 'cpsu-update',
      data: { url },
      renotify: false,
    });
    if (unread !== null && self.navigator && typeof self.navigator.setAppBadge === 'function') {
      try {
        if (unread > 0) await self.navigator.setAppBadge(unread);
        else if (typeof self.navigator.clearAppBadge === 'function') await self.navigator.clearAppBadge();
      } catch { /* Badging support varies by OS and launcher. */ }
    }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) client.postMessage({ type: 'CPSU_PUSH_RECEIVED' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(pushRoute(event.notification.data?.url), self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try {
        const page = typeof existing.navigate === 'function' ? await existing.navigate(url) : existing;
        await (page ?? existing).focus();
        return;
      } catch { /* Open a new tab if navigation of an existing client fails. */ }
    }
    await self.clients.openWindow(url);
  })());
});
