import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const source = readFileSync(resolve(import.meta.dir, '../../web/public/sw.js'), 'utf8');
type Handler = (event: any) => void;

function makeWorker(windows: any[] = [], failMatch = false) {
  const handlers = new Map<string, Handler>();
  const cacheItems: string[] = [];
  const removed: string[] = [];
  const notificationOptions: any[] = [];
  const opened: string[] = [];
  let skipped = 0;
  let claimed = 0;
  const caches = {
    open: async (_name: string) => ({ addAll: async (assets: string[]) => { cacheItems.push(...assets); } }),
    keys: async () => ['cpsu-offline-shell-v3', 'cpsu-offline-shell-v4', 'other-app-cache'],
    delete: async (name: string) => { removed.push(name); return true; },
    match: async (url: string) => url === '/offline.html' ? { status: 200, offline: true } : undefined,
  };
  const self = {
    location: { origin: 'https://market.example.test' },
    navigator: {},
    registration: { showNotification: async (_title: string, opts: any) => { notificationOptions.push(opts); } },
    addEventListener: (name: string, callback: Handler) => handlers.set(name, callback),
    skipWaiting: () => { skipped++; },
    clients: {
      claim: async () => { claimed++; },
      matchAll: async () => { if (failMatch) throw Error('window discovery unavailable'); return windows; },
      openWindow: async (url: string) => { opened.push(url); },
    },
  };
  vm.runInNewContext(source, { self, URL, Set, Number, Promise, caches, fetch: async () => { throw Error('offline'); } });
  const fire = async (name: string, extras: Record<string, unknown> = {}) => {
    let pending: Promise<unknown> | undefined;
    const event = { ...extras, waitUntil: (value: Promise<unknown>) => { pending = value; } };
    handlers.get(name)!(event);
    if (pending) await pending;
    return event;
  };
  return { handlers, fire, cacheItems, removed, notificationOptions, opened,
    skipped: () => skipped, claimed: () => claimed };
}

describe('PWA service-worker lifecycle and privacy', () => {
  it('preloads only the public offline fallback and waits for an explicit update choice', async () => {
    const worker = makeWorker();
    await worker.fire('install');
    expect(worker.skipped()).toBe(0);
    expect(worker.cacheItems).toContain('/offline.html');
    expect(worker.cacheItems.some(asset => asset.startsWith('/api/') || asset === '/index.html')).toBe(false);
    await worker.fire('message', { data: { type: 'CPSU_ACTIVATE_UPDATE' } });
    expect(worker.skipped()).toBe(1);
    await worker.fire('activate');
    expect(worker.removed).toEqual(['cpsu-offline-shell-v3']);
    expect(worker.claimed()).toBe(1);
  });

  it('intercepts only same-origin navigation and uses a public fallback when offline', async () => {
    const worker = makeWorker();
    const responses: Promise<unknown>[] = [];
    const request = (url: string, method = 'GET', mode = 'navigate') => ({
      method, mode, url,
    });
    for (const req of [
      request('https://market.example.test/api/v1/me'),
      request('https://external.example.test/'),
      request('https://market.example.test/messages', 'POST'),
      request('https://market.example.test/assets/app.js', 'GET', 'no-cors'),
    ]) {
      worker.handlers.get('fetch')!({ request: req, respondWith: (p: Promise<unknown>) => responses.push(p) });
    }
    expect(responses.length).toBe(0);
    worker.handlers.get('fetch')!({
      request: request('https://market.example.test/profile'),
      respondWith: (p: Promise<unknown>) => responses.push(p),
    });
    expect(responses.length).toBe(1);
    expect(await responses[0]).toMatchObject({ offline: true });
  });

  it('suppresses a duplicate banner on the focused destination while keeping in-app updates', async () => {
    const posted: unknown[] = [];
    const current = { url: 'https://market.example.test/inquiries/27', focused: true,
      postMessage: (message: unknown) => posted.push(message), focus: async () => {} };
    const worker = makeWorker([current]);
    await worker.fire('push', { data: { json: () => ({
      body: 'You have a new message.', url: '/inquiries/27',
      id: 31, type: 'inquiry.reply', tag: 'cpsu-31',
    }) } });
    expect(worker.notificationOptions).toHaveLength(0);
    expect(posted).toEqual([{ type: 'CPSU_PUSH_RECEIVED' }]);

    await worker.fire('push', { data: { json: () => ({
      body: 'Your listing was approved.', url: '/listings/20',
      id: 32, type: 'listing.decision', tag: 'cpsu-32',
    }) } });
    expect(worker.notificationOptions).toHaveLength(1);
    expect(worker.notificationOptions[0]?.data).toEqual({
      url: '/listings/20', id: 32, type: 'listing.decision',
    });
  });

  it('treats malformed or null push JSON as a generic, private notification', async () => {
    const worker = makeWorker();
    for (const value of [null, [], 42, 'private message', { body: 'PRIVATE', url: 'https://other.invalid' }]) {
      await worker.fire('push', { data: { json: () => value } });
      const last = worker.notificationOptions.at(-1);
      expect(last?.body).toBe('You have a new marketplace update.');
      expect(last?.data.url).toBe('/notifications');
    }
    expect(worker.notificationOptions).toHaveLength(5);
  });

  it('does not let a broken tab block alert delivery or other foreground updates', async () => {
    const notified: unknown[] = [];
    const broken = { url: 'https://market.example.test/dashboard', focused: false,
      postMessage: () => { throw new Error('tab navigated away'); } };
    const active = { url: 'https://market.example.test/profile', focused: false,
      postMessage: (value: unknown) => notified.push(value) };
    const worker = makeWorker([broken, active]);
    await worker.fire('push', { data: { json: () => ({
      body: 'You have a new marketplace inquiry.', url: '/inquiries/7', tag: 'cpsu-7',
    }) } });
    expect(worker.notificationOptions).toHaveLength(1);
    expect(notified).toEqual([{ type: 'CPSU_PUSH_RECEIVED' }]);
  });

  it('shows a safe alert even if checking foreground windows fails', async () => {
    const worker = makeWorker([], true);
    await worker.fire('push', { data: { json: () => ({
      body: 'You have a new message.', url: '/inquiries/7', tag: 'cpsu-9',
    }) } });
    expect(worker.notificationOptions).toHaveLength(1);
  });

  it('never navigates away from a different tab that may contain an unsaved draft', async () => {
    let focused = 0;
    const existing = { url: 'https://market.example.test/dashboard', focused: true,
      postMessage: () => {}, navigate: () => { throw Error('must not navigate'); },
      focus: async () => { focused++; } };
    const worker = makeWorker([existing]);
    const notification = (url: string) => ({ data: { url }, close: () => {} });
    await worker.fire('notificationclick', { notification: notification('/inquiries/27') });
    expect(worker.opened).toEqual(['https://market.example.test/inquiries/27']);
    expect(focused).toBe(0);

    existing.url = 'https://market.example.test/inquiries/27';
    await worker.fire('notificationclick', { notification: notification('/inquiries/27') });
    expect(focused).toBe(1);
    expect(worker.opened).toHaveLength(1);
  });
});

describe('background push navigation and subscription change safety', () => {
  const notification = (url: unknown) => ({ data: { url }, close: () => {} });

  it('opens the safe destination if the browser cannot enumerate clients on notification tap', async () => {
    const worker = makeWorker([], true);
    await worker.fire('notificationclick', { notification: notification('/inquiries/27') });
    expect(worker.opened).toEqual(['https://market.example.test/inquiries/27']);
  });

  it('rejects external and encoded routes even if push data is attacker-controlled', async () => {
    const worker = makeWorker();
    for (const target of [
      'https://another.example.test/steal', '//another.example.test',
      '/inquiries/27?redirect=https://another.example.test',
      '/%2e%2e/profile', '/transactions/0',
    ]) {
      await worker.fire('notificationclick', { notification: notification(target) });
    }
    expect(worker.opened).toEqual(Array(5).fill('https://market.example.test/notifications'));
  });

  it('opens a fresh window when a matching existing tab cannot be focused', async () => {
    const existing = {
      url: 'https://market.example.test/listings/6',
      focus: async () => { throw new Error('focus blocked by OS'); },
    };
    const worker = makeWorker([existing]);
    await worker.fire('notificationclick', { notification: notification('/listings/6') });
    expect(worker.opened).toEqual(['https://market.example.test/listings/6']);
  });

  it('notifies only open pages of a rotated subscription, without automatic reenrollment', async () => {
    const messages: unknown[] = [];
    const worker = makeWorker([{
      postMessage: (message: unknown) => messages.push(message),
    }]);
    await worker.fire('pushsubscriptionchange');
    expect(messages).toEqual([{ type: 'CPSU_PUSH_SUBSCRIPTION_CHANGED' }]);
    expect(worker.notificationOptions).toHaveLength(0);
    expect(worker.opened).toHaveLength(0);
  });

  it('handles subscription changes when the browser has no available windows', async () => {
    const worker = makeWorker([], true);
    await worker.fire('pushsubscriptionchange');
    expect(worker.opened).toHaveLength(0);
    expect(worker.notificationOptions).toHaveLength(0);
  });
});
