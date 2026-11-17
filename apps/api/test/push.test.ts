import { describe, expect, it } from 'bun:test';
import { categoryForNotice, endpointHash, permittedPushEndpoint, pushContent } from '../src/push.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

describe('Web Push security and privacy', () => {
  it('accepts known browser push services but rejects local/private and fake provider endpoints', () => {
    expect(permittedPushEndpoint('https://fcm.googleapis.com/fcm/send/synthetic')).toBe(true);
    expect(permittedPushEndpoint('https://web.push.apple.com/synthetic')).toBe(true);
    expect(permittedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example')).toBe(true);
    for (const url of [
      'http://127.0.0.1:4000/', 'https://127.0.0.1/push',
      'https://fcm.googleapis.com.evil.invalid/send', 'https://evil.invalid/push',
      'https://localhost/admin', 'file:///etc/passwd', 'https://user:pass@fcm.googleapis.com/send',
      'https://fcm.googleapis.com:4443/send',
    ]) expect(permittedPushEndpoint(url)).toBe(false);
  });

  it('hashes the endpoint without storing a searchable partial URL', () => {
    const hash = endpointHash('https://fcm.googleapis.com/fcm/send/secret-synthetic-token');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain('secret');
  });

  it('uses generic locked-screen copy and internal-only navigation for each event', () => {
    const data = { threadId: 27, listingId: 19, listingTitle: 'Highly personal listing', body: 'PRIVATE MESSAGE', reason: 'PRIVATE REVIEW', name: 'PRIVATE NAME' };
    const events = [
      ['inquiry.new', 'messages', '/inquiries/27'],
      ['inquiry.reply', 'messages', '/inquiries/27'],
      ['listing.decision', 'listingReviews', '/listings/19'],
      ['listing.suspended', 'listingReviews', '/listings/19'],
      ['affiliation.decision', 'accountUpdates', '/profile'],
      ['store.new_listing', 'accountUpdates', '/listings/19'],
      ['transaction.requested', 'accountUpdates', '/notifications'],
      ['transaction.completion_confirmed', 'accountUpdates', '/notifications'],
    ] as const;
    for (const [event, category, path] of events) {
      expect(categoryForNotice(event)).toBe(category);
      const payload = pushContent(event, data, 12, 4)!;
      expect(payload.url).toBe(path);
      expect(payload.title).toBe('CPSU Market');
      expect(payload.unread).toBe(4);
      expect(payload.tag).toBe('cpsu-12');
      expect(JSON.stringify(payload)).not.toMatch(/PRIVATE|Highly personal/);
    }
    expect(pushContent('transaction.requested', { transactionId: 41 }, 20, 2)).toEqual({
      title: 'CPSU Market', body: 'A student sent you a purchase or service request.',
      url: '/transactions/41', tag: 'cpsu-20', unread: 2,
    });
    expect(pushContent('transaction.accepted', { transactionId: 41 }, 21, 2)?.url).toBe('/transactions/41');
    expect(pushContent('transaction.negotiating', { transactionId: 41 }, 22, 2)).toBe(null);
    expect(pushContent('unrecognized', data, 1, 0)).toBe(null);
    expect(pushContent('inquiry.reply', { threadId: 'https://evil.invalid' }, 1, 0)?.url).toBe('/notifications');
    expect(pushContent('store.new_listing', { listingId: 'https://evil.invalid',
      storeName: 'PRIVATE STORE', listingTitle: 'PRIVATE ITEM' }, 2, 1)).toEqual({
      title: 'CPSU Market',
      body: 'A store you follow has published a new listing.',
      url: '/notifications', tag: 'cpsu-2', unread: 1,
    });
  });
});

describe('service worker notification safeguards', () => {
  it('shows a private alert, sets supported badge and opens an internal path', async () => {
    const listeners = new Map<string, (e: any) => void>();
    const notices: { title: string; options: any }[] = [];
    const badges: number[] = [];
    const opened: string[] = [];
    const worker: any = {
      location: { origin: 'https://market.example.test' },
      registration: { showNotification: async (title: string, options: any) => { notices.push({ title, options }); } },
      navigator: { setAppBadge: async (count: number) => { badges.push(count); } },
      clients: { matchAll: async () => [], openWindow: async (url: string) => { opened.push(url); } },
      addEventListener: (type: string, fn: (e: any) => void) => { listeners.set(type, fn); },
      skipWaiting: () => {},
    };
    const source = readFileSync(resolve(import.meta.dir, '../../web/public/sw.js'), 'utf8');
    vm.runInNewContext(source, { self: worker, URL, Set, Number, Promise, caches: {}, fetch: () => {} });
    let running: Promise<unknown> | null = null;
    listeners.get('push')!({
      data: { json: () => ({
        title: 'Forged title', body: 'This is sensitive message body', url: 'https://evil.invalid/',
        tag: 'not-a-valid-tag', unread: 5,
      }) },
      waitUntil: (promise: Promise<unknown>) => { running = promise; },
    });
    await running;
    expect(notices[0]?.title).toBe('CPSU Market');
    expect(notices[0]?.options.body).toBe('You have a new marketplace update.');
    expect(notices[0]?.options.data.url).toBe('/notifications');
    expect(badges).toEqual([5]);

    // Exercise the actual deployed worker with both newly supported notification bodies.
    for (const [body, route] of [
      ['A store you follow has published a new listing.', '/listings/19'],
      ['The other student updated your transaction.', '/transactions/41'],
    ]) {
      listeners.get('push')!({
        data: { json: () => ({ body, url: route, tag: 'cpsu-31' }) },
        waitUntil: (promise: Promise<unknown>) => { running = promise; },
      });
      await running;
      expect(notices.at(-1)?.options.body).toBe(body);
      expect(notices.at(-1)?.options.data.url).toBe(route);
    }
    listeners.get('notificationclick')!({
      notification: { data: { url: '/inquiries/27' }, close: () => {} },
      waitUntil: (promise: Promise<unknown>) => { running = promise; },
    });
    await running;
    expect(opened).toEqual(['https://market.example.test/inquiries/27']);

    listeners.get('notificationclick')!({
      notification: { data: { url: '/transactions/41' }, close: () => {} },
      waitUntil: (promise: Promise<unknown>) => { running = promise; },
    });
    await running;
    expect(opened.at(-1)).toBe('https://market.example.test/transactions/41');
  });
});
