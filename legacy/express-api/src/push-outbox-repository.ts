/**
 * Prisma persistence adapter for the leased Web Push outbox.
 */
import type { Prisma } from '@prisma/client';
import { PUSH_MAX_ATTEMPTS } from './push-delivery-controls.js';
import type {
  PushCompletion, PushJob, PushLease, PushLeasePort,
} from './push-outbox-worker.js';

export type PushOutboxDelegate = {
  findMany: (query: Prisma.PushOutboxFindManyArgs) => Promise<PushJob[]>;
  updateMany: (query: Prisma.PushOutboxUpdateManyArgs) => Promise<{ count: number }>;
};

export type PushOutboxDataSource = { pushOutbox: PushOutboxDelegate };

const claimable = (now: Date) => ({
  expiresAt: { gt: now },
  attemptCount: { lt: PUSH_MAX_ATTEMPTS },
  OR: [
    { state: 'pending', nextAttemptAt: { lte: now } },
    { state: 'leased', leasedUntil: { lte: now } },
  ],
});

/**
 * List+CAS is safe when multiple worker processes discover the same row:
 * an updateMany with an identical WHERE fence allows only one claimant.
 * The old lease must be *expired* before another worker can take the row.
 */
export class PrismaPushLeasePort implements PushLeasePort {
  constructor(private readonly db: PushOutboxDataSource) {}

  async listDue(now: Date, limit: number): Promise<PushJob[]> {
    return this.db.pushOutbox.findMany({
      where: claimable(now),
      select: {
        id: true, notificationId: true, userId: true, category: true,
        attemptCount: true, expiresAt: true,
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async claimOne(id: number, token: string, now: Date, until: Date): Promise<boolean> {
    const result = await this.db.pushOutbox.updateMany({
      where: { id, ...claimable(now) },
      data: {
        state: 'leased', leaseToken: token, leasedUntil: until,
        attemptCount: { increment: 1 },
      },
    });
    return result.count === 1;
  }

  async settle(lease: PushLease, update: PushCompletion): Promise<boolean> {
    const now = new Date();
    const result = await this.db.pushOutbox.updateMany({
      where: {
        id: lease.id, leaseToken: lease.leaseToken, state: 'leased',
        // A crashed/slow worker must not overwrite the next owner's result.
        leasedUntil: { gt: now },
      },
      data: {
        state: update.state, leaseToken: null, leasedUntil: null,
        lastStatus: update.status,
        ...(update.state === 'pending' ? { nextAttemptAt: update.nextAttemptAt } : {}),
        ...(update.state === 'sent' ? { sentAt: now } : {}),
      },
    });
    return result.count === 1;
  }

  /** Safe retention transition for expired jobs not currently in the relay. */
  async expireDue(now: Date): Promise<number> {
    const result = await this.db.pushOutbox.updateMany({
      where: { expiresAt: { lte: now }, state: { in: ['pending', 'leased'] } },
      data: {
        state: 'skipped', lastStatus: 'expired',
        leaseToken: null, leasedUntil: null,
      },
    });
    return result.count;
  }

  /** Crash recovery: exhausted jobs cannot remain permanently claimable. */
  async expireExhausted(now: Date): Promise<number> {
    const result = await this.db.pushOutbox.updateMany({
      where: {
        expiresAt: { gt: now }, attemptCount: { gte: PUSH_MAX_ATTEMPTS },
        OR: [
          { state: 'pending' },
          { state: 'leased', leasedUntil: { lte: now } },
        ],
      },
      data: {
        state: 'failed', lastStatus: 'attempt_limit',
        leaseToken: null, leasedUntil: null,
      },
    });
    return result.count;
  }
}
