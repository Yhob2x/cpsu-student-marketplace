import { describe, expect, test } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { publishSellerAvatar } from '../src/seller-avatar-update.js';

function harness(options: { ownerUserId?: number; previous?: string | null; concurrent?: boolean; auditFails?: boolean } = {}) {
  let current = options.previous ?? null;
  const audits: unknown[] = [];
  const calls: string[] = [];
  const ownerUserId = options.ownerUserId ?? 7;
  const db = {
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      let staged = current;
      let stagedAudit: unknown = null;
      const tx = {
        sellerProfile: {
          findFirst: async ({ where }: any) => {
            calls.push('find');
            return where.ownerUserId === ownerUserId && where.approvalStatus === 'approved'
              ? { id: 23, avatarPath: staged } : null;
          },
          updateMany: async ({ where, data }: any) => {
            calls.push('update');
            if (options.concurrent || where.ownerUserId !== ownerUserId || where.avatarPath !== staged) return { count: 0 };
            staged = data.avatarPath;
            return { count: 1 };
          },
        },
        auditLog: { create: async ({ data }: any) => {
          calls.push('audit');
          if (options.auditFails) throw new Error('synthetic audit failure');
          stagedAudit = data;
          return { id: 20 };
        } },
      };
      const result = await callback(tx);
      current = staged; // commit only after both mutation and audit succeeded
      if (stagedAudit) audits.push(stagedAudit);
      return result;
    },
  } as unknown as Pick<PrismaClient, '$transaction'>;
  return { db, getCurrent: () => current, audits, calls };
}

describe('seller photo instant publishing (synthetic database transaction)', () => {
  test('publishes the selected photo immediately and audits the decision', async () => {
    const h = harness();
    const result = await publishSellerAvatar(h.db, 7, 'new-image.webp');
    expect(result).toEqual({ id: 23, previousPath: null });
    expect(h.getCurrent()).toBe('new-image.webp');
    expect(h.calls).toEqual(['find', 'update', 'audit']);
    expect(h.audits).toEqual([{
      actorUserId: 7, action: 'seller.avatar_published',
      targetType: 'seller_profile', targetId: 23,
    }]);
  });

  test('replaces an existing photo while returning its previous storage reference', async () => {
    const h = harness({ previous: 'old-image.webp' });
    expect(await publishSellerAvatar(h.db, 7, 'replacement.webp'))
      .toEqual({ id: 23, previousPath: 'old-image.webp' });
    expect(h.getCurrent()).toBe('replacement.webp');
  });

  test('rejects uploads by anyone other than the store owner', async () => {
    const h = harness();
    await expect(publishSellerAvatar(h.db, 9, 'unauthorized.webp'))
      .rejects.toMatchObject({ status: 403, code: 'no_approved_store' });
    expect(h.getCurrent()).toBeNull();
    expect(h.audits).toHaveLength(0);
  });

  test('rejects a stale concurrent photo replacement', async () => {
    const h = harness({ previous: 'already.webp', concurrent: true });
    await expect(publishSellerAvatar(h.db, 7, 'racing.webp'))
      .rejects.toMatchObject({ status: 409, code: 'avatar_changed' });
    expect(h.getCurrent()).toBe('already.webp');
    expect(h.audits).toHaveLength(0);
  });

  test('audit failure rolls back the stored public avatar reference', async () => {
    const h = harness({ previous: 'safe.webp', auditFails: true });
    await expect(publishSellerAvatar(h.db, 7, 'would-be.webp'))
      .rejects.toThrow('synthetic audit failure');
    expect(h.getCurrent()).toBe('safe.webp');
    expect(h.audits).toHaveLength(0);
  });
});
