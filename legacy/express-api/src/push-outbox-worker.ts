/**
 * Stage 6B: retryable, lease-fenced outbox state machine.
 * The API starts this only when the durable delivery release gate allows it.
 */
import { randomUUID } from 'node:crypto';
import { allSettledBounded } from './push-delivery.js';
import { nextRetryAt, PUSH_MAX_ATTEMPTS, type ProviderFailure } from './push-delivery-controls.js';
import { pushDeliveryReady } from './push.js';

export const PUSH_OUTBOX_LEASE_MS = 90_000;
export const PUSH_OUTBOX_MAX_BATCH = 8;
export const PUSH_OUTBOX_WORKERS = 2;

export type PushJob = {
  id: number;
  notificationId: number;
  userId: number;
  category: string;
  attemptCount: number;
  expiresAt: Date;
};

export type PushLease = PushJob & {
  leaseToken: string;
  leasedUntil: Date;
};

export type PushCompletion =
  | { state: 'sent' | 'skipped' | 'failed'; status: string }
  | { state: 'pending'; status: string; nextAttemptAt: Date };

export type PushDeliveryResult =
  | { outcome: 'sent' }
  | { outcome: 'suppressed'; reason: string }
  | { outcome: 'retry'; at: Date }
  | { outcome: 'failed'; status: ProviderFailure; retryAfterSeconds?: number | null; terminal?: boolean };

/**
 * Adapter must claim with a single SQL update WHERE id, due state and expiry.
 * Settling must compare both id and leaseToken to reject stale workers.
 */
export interface PushLeasePort {
  listDue(now: Date, limit: number): Promise<PushJob[]>;
  claimOne(id: number, token: string, now: Date, until: Date): Promise<boolean>;
  settle(lease: PushLease, update: PushCompletion): Promise<boolean>;
}

export async function claimPushJobs(
  port: PushLeasePort,
  now: Date,
  limit = PUSH_OUTBOX_MAX_BATCH,
  tokenFactory: () => string = randomUUID,
): Promise<PushLease[]> {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid push claim time');
  const count = Math.min(PUSH_OUTBOX_MAX_BATCH, Math.max(0, Math.floor(limit) || 0));
  if (count === 0) return [];
  const due = await port.listDue(now, count);
  const leases: PushLease[] = [];
  for (const item of due.slice(0, count)) {
    if (item.expiresAt <= now) continue;
    const token = tokenFactory();
    if (!/^[\w-]{8,64}$/.test(token)) throw new Error('Invalid push lease token');
    const until = new Date(now.getTime() + PUSH_OUTBOX_LEASE_MS);
    // Contending workers can enumerate the same due row; only the CAS winner owns it.
    if (await port.claimOne(item.id, token, now, until)) {
      leases.push({ ...item, leaseToken: token, leasedUntil: until });
    }
  }
  return leases;
}

/**
 * A production adapter's deliver callback must enforce recipient consent,
 * reservation, per-device ledger and expiration BEFORE making provider calls.
 * Never retry terminal failures or suppressions. No process timers are installed.
 */
export async function runPushOutboxTick(
  port: PushLeasePort,
  deliver: (lease: PushLease) => Promise<PushDeliveryResult>,
  now: Date,
  opts: { enabled?: boolean; concurrency?: number; batchSize?: number; jitter?: () => number; now?: () => Date } = {},
): Promise<{ claimed: number; settled: number; lostLeases: number }> {
  if (!opts.enabled) return { claimed: 0, settled: 0, lostLeases: 0 };
  const jobs = await claimPushJobs(port, now, opts.batchSize);
  let settled = 0;
  let lostLeases = 0;
  const clock = opts.now ?? (() => now);
  const outcomes = await allSettledBounded(jobs, opts.concurrency ?? PUSH_OUTBOX_WORKERS, async lease => {
    let completion: PushCompletion;
    try {
      if (lease.expiresAt <= clock()) {
        completion = { state: 'skipped', status: 'expired' };
      } else {
        const delivered = await deliver(lease);
        if (delivered.outcome === 'sent') {
          completion = { state: 'sent', status: 'accepted' };
        } else if (delivered.outcome === 'suppressed') {
          completion = { state: 'skipped', status: delivered.reason };
        } else if (delivered.outcome === 'retry') {
          completion = lease.attemptCount + 1 < PUSH_MAX_ATTEMPTS && delivered.at < lease.expiresAt
            ? { state: 'pending', status: 'device_retry', nextAttemptAt: delivered.at }
            : { state: 'failed', status: 'device_retry_expired' };
        } else {
          const retry = !delivered.terminal && nextRetryAt(
            delivered.status, lease.attemptCount + 1, clock(), lease.expiresAt,
            delivered.retryAfterSeconds ?? null, opts.jitter?.() ?? 0.5,
          );
          completion = retry
            ? { state: 'pending', status: String(delivered.status), nextAttemptAt: retry }
            : { state: 'failed', status: String(delivered.status) };
        }
      }
    } catch {
      // Never log exception messages; provider errors may include capability URLs.
      const retry = nextRetryAt('network_error', lease.attemptCount + 1, clock(), lease.expiresAt,
        null, opts.jitter?.() ?? 0.5);
      completion = retry
        ? { state: 'pending', status: 'network_error', nextAttemptAt: retry }
        : { state: 'failed', status: 'network_error' };
    }
    // A second worker may have reclaimed an expired lease. Its token wins.
    if (await port.settle(lease, completion)) settled++;
    else lostLeases++;
  });
  // Do not swallow persistence failures and claim a successful drain.
  const error = outcomes.find(result => result.status === 'rejected');
  if (error?.status === 'rejected') throw new Error('Push outbox persistence failed');
  return { claimed: jobs.length, settled, lostLeases };
}

export const pushOutboxTickActivated = pushDeliveryReady;
export function runConfiguredPushOutboxTick(
  port: PushLeasePort,
  deliver: (lease: PushLease) => Promise<PushDeliveryResult>,
  now = new Date(),
): Promise<{ claimed: number; settled: number; lostLeases: number }> {
  return runPushOutboxTick(port, deliver, now, {
    enabled: pushOutboxTickActivated, batchSize: PUSH_OUTBOX_WORKERS, now: () => new Date(),
  });
}
