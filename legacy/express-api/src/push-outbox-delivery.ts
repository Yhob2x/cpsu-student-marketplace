import type { PrismaClient } from '@prisma/client';
import { categoryForNotice, endpointHash, permittedPushEndpoint, pushContent, type PushContent } from './push.js';
import { PUSH_RELAY_TIMEOUT_MS, pushStatus } from './push-delivery.js';
import { evaluatePushEligibility, nextRetryAt } from './push-delivery-controls.js';
import { reserveRecipientBudget } from './push-outbox-budget.js';
import type { PushDeliveryResult, PushLease } from './push-outbox-worker.js';

type Device = { endpoint: string; p256dh: string; auth: string };
export type PushRelay = (device: Device, payload: PushContent, ttl: number) => Promise<unknown>;

function retryAfter(error: unknown, now: Date): number | null {
  const header = (error as { headers?: Record<string, unknown> } | null)?.headers?.['retry-after'];
  if (typeof header !== 'string') return null;
  const value = header.trim();
  if (/^\d+$/.test(value)) return Number(value);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, (date - now.getTime()) / 1000) : null;
}

const fence = (lease: PushLease, now: Date) => ({
  id: lease.id, userId: lease.userId, state: 'leased', leaseToken: lease.leaseToken,
  leasedUntil: { gt: now }, expiresAt: { gt: now },
});

async function recordAttempt(
  db: PrismaClient, lease: PushLease, device: { id: number; endpointHash: string; updatedAt: Date },
  state: 'sent' | 'pending' | 'failed', status: string, nextAttemptAt: Date, remove: boolean,
) {
  return db.$transaction(async tx => {
    // Lock the current lease while recording an outcome. A reclaimed job must
    // never have its new worker's device ledger overwritten by the old worker.
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM PushOutbox
      WHERE id = ${lease.id} AND userId = ${lease.userId} AND state = 'leased'
      AND leaseToken = ${lease.leaseToken} AND leasedUntil > UTC_TIMESTAMP(3)
      AND expiresAt > UTC_TIMESTAMP(3) FOR UPDATE`;
    if (rows.length === 0) return false;
    const key = { outboxId: lease.id, endpointHash: device.endpointHash };
    await tx.pushAttempt.upsert({
      where: { outboxId_endpointHash: key },
      create: { ...key, state, lastStatus: status, nextAttemptAt, attemptCount: 1 },
      update: { state, lastStatus: status, nextAttemptAt, attemptCount: { increment: 1 } },
    });
    if (remove) await tx.pushSubscription.deleteMany({ where: {
      id: device.id, userId: lease.userId, endpointHash: device.endpointHash, updatedAt: device.updatedAt,
    } });
    return true;
  });
}

/** A leased job can contact the relay only after live consent and quota checks. */
export function createPushOutboxDelivery(
  db: PrismaClient, send: PushRelay, clock = () => new Date(), signal?: AbortSignal,
): (lease: PushLease) => Promise<PushDeliveryResult> {
  return async lease => {
    const notice = await db.notification.findFirst({
      where: { id: lease.notificationId, userId: lease.userId }, select: { type: true, payload: true },
    });
    const category = notice && categoryForNotice(notice.type);
    if (!notice || !category || category !== lease.category) return { outcome: 'suppressed', reason: 'invalid_notice' };
    const data = notice.payload && typeof notice.payload === 'object' && !Array.isArray(notice.payload)
      ? notice.payload : {};
    const unread = await db.notification.count({ where: { userId: lease.userId, readAt: null } });
    const payload = pushContent(notice.type, data, lease.notificationId, unread);
    if (!payload) return { outcome: 'suppressed', reason: 'invalid_notice' };

    const attempts = await db.pushAttempt.findMany({ where: { outboxId: lease.id },
      select: { endpointHash: true, state: true, nextAttemptAt: true, lastStatus: true } });
    const byEndpoint = new Map(attempts.map(attempt => [attempt.endpointHash, attempt]));
    let accepted = attempts.some(attempt => attempt.state === 'sent');
    let retryAt: Date | undefined;
    const persistedFailure = attempts.find(attempt => attempt.state === 'failed'
      && (attempt.lastStatus === 'network_error' || /^[1-5]\d\d$/.test(attempt.lastStatus ?? '')));
    let lastFailure = persistedFailure
      ? pushStatus({ statusCode: Number(persistedFailure.lastStatus) }) : undefined;
    let suppression = 'no_subscription';
    const candidates = await db.pushSubscription.findMany({
      where: { userId: lease.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: clock() } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8,
      select: { id: true, endpointHash: true },
    });
    for (const candidate of candidates) {
      if (signal?.aborted) return { outcome: 'failed', status: 'network_error' };
      const previous = byEndpoint.get(candidate.endpointHash);
      if (previous && previous.state !== 'pending') continue;
      if (previous && previous.nextAttemptAt > clock()) {
        if (!retryAt || previous.nextAttemptAt > retryAt) retryAt = previous.nextAttemptAt;
        continue;
      }

      const currentDevice = () => db.pushSubscription.findFirst({
        where: { ...candidate, userId: lease.userId, OR: [{ expiresAt: null }, { expiresAt: { gt: clock() } }] },
        include: { user: { select: { status: true, pushPreference: true } } },
      });
      const eligibility = (device: NonNullable<Awaited<ReturnType<typeof currentDevice>>>) => {
        const pref = device.user.pushPreference;
        return evaluatePushEligibility({
          activeUser: device.user.status === 'active', validSubscription: true,
          masterEnabled: pref?.masterEnabled ?? true, categoryEnabled: pref?.[category] ?? true,
          quietStartMinute: pref?.quietStartMinute ?? null, quietEndMinute: pref?.quietEndMinute ?? null,
          reservedToday: 0, // The actual quota is enforced by the atomic reservation below.
        }, clock());
      };

      const enrolled = await currentDevice();
      if (!enrolled) continue;
      const before = eligibility(enrolled);
      if (!before.allowed) { suppression = before.reason; retryAt = undefined; break; }
      if (!permittedPushEndpoint(enrolled.endpoint) || endpointHash(enrolled.endpoint) !== enrolled.endpointHash) {
        const persisted = await recordAttempt(db, lease, enrolled, 'failed', 'invalid_endpoint', clock(), true);
        if (!persisted) return { outcome: 'suppressed', reason: 'lost_lease' };
        continue;
      }
      const reservation = await reserveRecipientBudget(db, lease, clock());
      if (reservation === 'lost_lease') return { outcome: 'suppressed', reason: reservation };
      if (reservation === 'capped' || reservation === 'stale_day') {
        suppression = reservation === 'capped' ? 'daily_cap' : reservation;
        retryAt = undefined;
        break;
      }
      const ownsLease = await db.pushOutbox.findFirst({ where: fence(lease, clock()), select: { id: true } });
      if (!ownsLease) return { outcome: 'suppressed', reason: 'lost_lease' };
      const device = await currentDevice();
      if (!device || !permittedPushEndpoint(device.endpoint) || endpointHash(device.endpoint) !== device.endpointHash) continue;
      const after = eligibility(device);
      if (!after.allowed) { suppression = after.reason; retryAt = undefined; break; }
      if (after.dayKey !== before.dayKey) { suppression = 'stale_day'; retryAt = undefined; break; }
      const now = clock().getTime();
      const remainingLease = lease.leasedUntil.getTime() - now;
      const ttl = Math.floor((lease.expiresAt.getTime() - now) / 1000);
      if (ttl < 1 || remainingLease <= 0) return { outcome: 'suppressed', reason: 'lost_lease' };
      if (signal?.aborted || remainingLease <= PUSH_RELAY_TIMEOUT_MS) return { outcome: 'failed', status: 'network_error' };

      let status: ReturnType<typeof pushStatus> | 'accepted' = 'accepted';
      let next: Date | null = null;
      try {
        await send(device, payload, ttl);
      } catch (error) {
        status = pushStatus(error);
        const failedAt = clock();
        next = nextRetryAt(status, lease.attemptCount + 1, failedAt, lease.expiresAt,
          status === 429 ? retryAfter(error, failedAt) : null);
      }
      const persisted = await recordAttempt(db, lease, device, status === 'accepted' ? 'sent' : next ? 'pending' : 'failed',
        String(status), next ?? clock(), status === 404 || status === 410);
      if (!persisted) return { outcome: 'suppressed', reason: 'lost_lease' };
      if (status === 'accepted') accepted = true;
      else lastFailure = status;
      // A claim is shared by all devices. Wait until each pending device is due
      // so repeated early retries cannot exhaust the job before Retry-After.
      if (next && (!retryAt || next > retryAt)) retryAt = next;
    }
    if (retryAt) return { outcome: 'retry', at: retryAt };
    if (accepted) return { outcome: 'sent' };
    if (lastFailure !== undefined) return { outcome: 'failed', status: lastFailure, terminal: true };
    return { outcome: 'suppressed', reason: suppression };
  };
}
