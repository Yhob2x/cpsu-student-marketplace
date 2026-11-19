import { describe, expect, it } from 'bun:test';
import {
  claimPushJobs, runPushOutboxTick, runConfiguredPushOutboxTick, PUSH_OUTBOX_LEASE_MS, PUSH_OUTBOX_MAX_BATCH,
  pushOutboxTickActivated, type PushJob, type PushLease, type PushLeasePort,
  type PushCompletion,
} from '../src/push-outbox-worker.js';

const start = new Date('2026-11-19T06:00:00Z');
const makeJob = (id: number): PushJob => ({
  id, userId: 42, notificationId: 1000 + id, category: 'messages', attemptCount: 0,
  expiresAt: new Date(start.getTime() + 60 * 60_000),
});
class FakeStore implements PushLeasePort {
  readonly jobs = new Map<number, PushJob & {
    state: string; nextAttemptAt: Date; leaseToken: string | null; leasedUntil: Date | null;
  }>();
  constructor(ids: number[]) {
    for (const id of ids) this.jobs.set(id, {
      ...makeJob(id), state: 'pending', nextAttemptAt: start, leaseToken: null, leasedUntil: null,
    });
  }
  async listDue(now: Date, limit: number): Promise<PushJob[]> {
    return [...this.jobs.values()]
      .filter(j => j.expiresAt > now && (
        (j.state === 'pending' && j.nextAttemptAt <= now)
        || (j.state === 'leased' && j.leasedUntil !== null && j.leasedUntil <= now)
      )).slice(0, limit).map(({ state, nextAttemptAt, leaseToken, leasedUntil, ...job }) => ({ ...job }));
  }
  async claimOne(id: number, token: string, now: Date, until: Date): Promise<boolean> {
    const j = this.jobs.get(id);
    if (!j || j.expiresAt <= now || !(
      (j.state === 'pending' && j.nextAttemptAt <= now)
      || (j.state === 'leased' && j.leasedUntil !== null && j.leasedUntil <= now)
    )) return false;
    j.state = 'leased'; j.leaseToken = token; j.leasedUntil = until; j.attemptCount++;
    return true;
  }
  async settle(lease: PushLease, update: PushCompletion): Promise<boolean> {
    const j = this.jobs.get(lease.id);
    if (!j || j.state !== 'leased' || j.leaseToken !== lease.leaseToken) return false;
    j.state = update.state;
    j.leaseToken = null;
    j.leasedUntil = null;
    if (update.state === 'pending') j.nextAttemptAt = update.nextAttemptAt;
    return true;
  }
}

describe('leased durable outbox state machine, synthetic, no provider or SQL', () => {
  it('remains hard-off even if called without options', async () => {
    expect(pushOutboxTickActivated).toBe(false);
    const store = new FakeStore([1]);
    let calls = 0;
    expect(await runPushOutboxTick(store, async () => { calls++; return { outcome: 'sent' }; }, start))
      .toEqual({ claimed: 0, settled: 0, lostLeases: 0 });
    expect(await runConfiguredPushOutboxTick(store, async () => { calls++; return { outcome: 'sent' }; }, start))
      .toEqual({ claimed: 0, settled: 0, lostLeases: 0 });
    expect(calls).toBe(0);
    expect(store.jobs.get(1)?.state).toBe('pending');
  });

  it('claims a bounded batch and never processes expired rows', async () => {
    const store = new FakeStore(Array.from({ length: 20 }, (_, i) => i + 1));
    store.jobs.get(20)!.expiresAt = start;
    const leases = await claimPushJobs(store, start, 100);
    expect(leases).toHaveLength(PUSH_OUTBOX_MAX_BATCH);
    expect(leases.every(lease => lease.leaseToken.length >= 8)).toBe(true);
    expect(leases.every(lease => lease.leasedUntil.getTime() - start.getTime() === PUSH_OUTBOX_LEASE_MS)).toBe(true);
    expect(store.jobs.get(20)?.state).toBe('pending');
  });

  it('a second simultaneous claimant cannot claim the same still-leased job', async () => {
    const store = new FakeStore([1]);
    const [a, b] = await Promise.all([claimPushJobs(store, start), claimPushJobs(store, start)]);
    expect(a.length + b.length).toBe(1);
    expect(store.jobs.get(1)?.attemptCount).toBe(1);
  });

  it('expired leases may be reclaimed, but stale acknowledgments never win', async () => {
    const store = new FakeStore([1]);
    const first = (await claimPushJobs(store, start))[0]!;
    expect(await claimPushJobs(store, new Date(start.getTime() + PUSH_OUTBOX_LEASE_MS - 1))).toHaveLength(0);
    const recovered = (await claimPushJobs(store, new Date(start.getTime() + PUSH_OUTBOX_LEASE_MS)))[0]!;
    expect(recovered.leaseToken).not.toBe(first.leaseToken);
    expect(await store.settle(first, { state: 'sent', status: 'accepted' })).toBe(false);
    expect(await store.settle(recovered, { state: 'sent', status: 'accepted' })).toBe(true);
    expect(store.jobs.get(1)?.state).toBe('sent');
    expect(store.jobs.get(1)?.attemptCount).toBe(2);
  });

  it('retries 503 with bounded backoff; does not send again before due time', async () => {
    const store = new FakeStore([1]);
    const result = await runPushOutboxTick(store, async () => ({
      outcome: 'failed', status: 503,
    }), start, { enabled: true, jitter: () => 0.5 });
    expect(result).toEqual({ claimed: 1, settled: 1, lostLeases: 0 });
    const job = store.jobs.get(1)!;
    expect(job.state).toBe('pending');
    expect(job.nextAttemptAt.getTime() - start.getTime()).toBe(20_000);
    expect(await claimPushJobs(store, new Date(start.getTime() + 19_999))).toHaveLength(0);
    expect(await claimPushJobs(store, new Date(start.getTime() + 20_000))).toHaveLength(1);
  });

  it('honors Retry-After for 429 and does not retry permanently failed codes', async () => {
    for (const [status, expected] of [[429, 'pending'], [403, 'failed'], [410, 'failed']] as const) {
      const store = new FakeStore([1]);
      await runPushOutboxTick(store, async () => ({
        outcome: 'failed', status, retryAfterSeconds: 180,
      }), start, { enabled: true });
      expect(store.jobs.get(1)?.state).toBe(expected);
      if (status === 429) expect(store.jobs.get(1)?.nextAttemptAt.getTime()! - start.getTime()).toBe(180_000);
    }
  });

  it('never retries suppressed opt-outs, daily budgets, or quiet-hours failures', async () => {
    for (const reason of ['master_off', 'quiet_hours', 'daily_cap', 'stale_day', 'inactive']) {
      const store = new FakeStore([1]);
      await runPushOutboxTick(store, async () => ({ outcome: 'suppressed', reason }), start, { enabled: true });
      expect(store.jobs.get(1)?.state).toBe('skipped');
    }
  });

  it('bounds concurrent jobs; one failure does not prevent later jobs from settling', async () => {
    const store = new FakeStore([1, 2, 3, 4, 5, 6, 7, 8]);
    let concurrent = 0, peak = 0, called = 0;
    const result = await runPushOutboxTick(store, async lease => {
      called++; concurrent++; peak = Math.max(peak, concurrent);
      try {
        await Promise.resolve();
        if (lease.id === 3) throw Error('synthetic transient failure');
        return { outcome: 'sent' };
      } finally { concurrent--; }
    }, start, { enabled: true, concurrency: 2 });
    expect(result).toEqual({ claimed: 8, settled: 8, lostLeases: 0 });
    expect(peak).toBe(2);
    expect(called).toBe(8);
    expect(store.jobs.get(3)?.state).toBe('pending');
    expect([...store.jobs.values()].filter(j => j.state === 'sent')).toHaveLength(7);
  });
});
