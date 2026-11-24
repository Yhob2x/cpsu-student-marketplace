import { describe, expect, it } from 'bun:test';
import { generateVAPIDKeys } from 'web-push';
import { allSettledBounded, createPushRelay } from '../src/push-delivery.js';

describe('Web Push relay request (no network)', () => {
  it('encrypts the payload, attaches an abort deadline, and returns a private Retry-After error', async () => {
    const endpoint = 'https://fcm.googleapis.com/fcm/send/synthetic-device';
    const device = { endpoint, p256dh: generateVAPIDKeys().publicKey, auth: Buffer.alloc(16).toString('base64url') };
    const payload = { title: 'CPSU Market', body: 'You have a new message.', url: '/inquiries/7',
      id: 1, tag: 'cpsu-1', type: 'inquiry.reply', unread: 2 } as const;
    let calls = 0;
    const relay = createPushRelay({ ...generateVAPIDKeys(), subject: 'mailto:qa@example.invalid' }, undefined,
      async (url, options) => {
        calls++;
        expect(url).toBe(endpoint);
        expect(options?.method).toBe('POST');
        expect(options?.redirect).toBe('manual');
        expect(options?.signal).toBeInstanceOf(AbortSignal);
        expect(new Headers(options?.headers).get('ttl')).toBe('30');
        expect(new Headers(options?.headers).get('content-encoding')).toBe('aes128gcm');
        expect(Buffer.from(options?.body as Uint8Array).includes(payload.body)).toBe(false);
        return new Response('DO NOT RETAIN', { status: 429, headers: { 'Retry-After': '60' } });
      });
    await expect(relay(device, payload, 30)).rejects.toEqual({ statusCode: 429, headers: { 'retry-after': '60' } });
    expect(calls).toBe(1);
  });
});

describe('bounded per-notification device dispatch, no provider traffic', () => {
  it('limits to four active sends across eight device endpoints', async () => {
    let active = 0, peak = 0;
    const pending: Array<() => void> = [];
    const completed: number[] = [];
    const work = allSettledBounded(Array.from({ length: 8 }, (_, index) => index), 4, async index => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>(resolve => { pending.push(resolve); });
      completed.push(index);
      active--;
    });
    await Promise.resolve();
    expect(active).toBe(4);
    expect(peak).toBe(4);
    for (let i = 0; i < 8; i++) {
      const release = pending.shift();
      expect(release).toBeDefined();
      release!();
      await Promise.resolve();
      await Promise.resolve();
    }
    const results = await work;
    expect(completed).toHaveLength(8);
    expect(peak).toBe(4);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
  });

  it('preserves failed and successful device outcomes in input order', async () => {
    const calls: number[] = [];
    const results = await allSettledBounded([0, 1, 2, 3, 4], 2, async index => {
      calls.push(index);
      if (index === 1 || index === 3) throw Error('synthetic failure');
    });
    expect(calls).toHaveLength(5);
    expect(results.map(r => r.status)).toEqual([
      'fulfilled', 'rejected', 'fulfilled', 'rejected', 'fulfilled',
    ]);
  });

  it('handles empty subscriptions and accidental nonpositive concurrency safely', async () => {
    let calls = 0;
    expect(await allSettledBounded([], 4, async () => { calls++; })).toEqual([]);
    const statuses = await allSettledBounded([1, 2, 3], 0, async () => { calls++; });
    expect(statuses.map(r => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
    expect(calls).toBe(3);
  });

  it('processes a synthetic 2,000-task burst with bounded concurrency and no network', async () => {
    let active = 0, peak = 0, delivered = 0;
    const start = performance.now();
    const results = await allSettledBounded(
      Array.from({ length: 2_000 }, (_, i) => i), 4, async index => {
        active++;
        peak = Math.max(peak, active);
        await Promise.resolve();
        try {
          if (index % 97 === 0) throw Error('synthetic rejection');
          delivered++;
        } finally {
          active--;
        }
      },
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(results).toHaveLength(2_000);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(21);
    expect(delivered).toBe(1_979);
    expect(performance.now() - start).toBeLessThan(60_000);
    // This exercises only in-memory scheduling. It does not benchmark the DB
    // outbox, relay acceptance, actual throughput or device delivery.
  });
});
