import { describe, expect, it } from 'bun:test';
import { allSettledBounded, sendWithBoundedRetries } from '../src/push-delivery.js';

const failure = (statusCode?: number) => Object.assign(new Error('synthetic push failure'), { statusCode });

describe('bounded Web Push delivery (no network)', () => {
  it('does not retry when the provider confirms a dead subscription', async () => {
    let calls = 0;
    const result = await sendWithBoundedRetries(async () => { calls++; throw failure(410); }, async () => {});
    expect(result).toEqual({ outcome: 'expired', attempts: 1, status: 410 });
    expect(calls).toBe(1);
  });
  it('retries once after a transient provider error', async () => {
    let calls = 0;
    const pauses: number[] = [];
    const result = await sendWithBoundedRetries(async () => {
      if (++calls === 1) throw failure(503);
    }, async ms => { pauses.push(ms); });
    expect(result).toEqual({ outcome: 'sent', attempts: 2, status: 201 });
    expect(pauses).toEqual([400]);
  });
  it('stops after two transient attempts and never loops indefinitely', async () => {
    let calls = 0;
    const result = await sendWithBoundedRetries(async () => {
      calls++;
      throw failure();
    }, async () => {});
    expect(result).toEqual({ outcome: 'failed', attempts: 2, status: 'network_error' });
    expect(calls).toBe(2);
  });
  it('does not immediately retry rate limits, permission errors or invalid subscriptions', async () => {
    for (const code of [400, 401, 403, 429]) {
      let calls = 0;
      const result = await sendWithBoundedRetries(async () => {
        calls++; throw failure(code);
      }, async () => { throw new Error('Unexpected delay'); });
      expect(result.outcome).toBe('failed');
      expect(result.attempts).toBe(1);
      expect(calls).toBe(1);
    }
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
