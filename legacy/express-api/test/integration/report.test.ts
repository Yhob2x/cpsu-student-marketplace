import { beforeAll, afterAll, describe, expect, test } from 'bun:test';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { assertIsolatedTestDatabase, resetFixtures, seedFixtures } from './fixtures.js';

// No application DB/import before the opt-in flag and strict local test-DB guard.
// Ordinary "bun test" skips this entire suite without opening a database.
if (process.env.CPSU_INTEGRATION_TESTS === '1') {
  assertIsolatedTestDatabase();
  const { createApp } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const { hashPassword, signAccess } = await import('../../src/auth.js');
  const { createAuditedPublicReport } = await import('../../src/report-safety.js');
  const app = createApp();
  type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
  let fx: Fixtures;
  const token = (id: number) => ({ Authorization: 'Bearer ' + signAccess(id) });
  const url = '/api/v1/reports';
  const adminUrl = '/api/v1/admin/reports';
  const reason = 'Synthetic reporting acceptance: misleading listing';

  describe('B2a.3 public reports — guarded real MySQL acceptance', () => {
    beforeAll(async () => {
      assertIsolatedTestDatabase();
      await resetFixtures(prisma);
      fx = await seedFixtures(prisma, hashPassword);
    });
    afterAll(async () => {
      assertIsolatedTestDatabase();
      try { await resetFixtures(prisma); } finally { await prisma.$disconnect(); }
    });

    test('student can report a real public listing and approved seller; audit rows persist atomically', async () => {
      const listing = await request(app).post(url).set(token(fx.buyer.id))
        .send({ listingId: fx.published.id, reason: '  ' + reason + '  ' });
      expect(listing.status).toBe(201);
      const listingReport = await prisma.report.findUniqueOrThrow({ where: { id: listing.body.id } });
      expect(listingReport).toMatchObject({
        reporterUserId: fx.buyer.id, listingId: fx.published.id,
        sellerProfileId: null, reason, status: 'open',
      });
      expect(await prisma.auditLog.count({ where: {
        actorUserId: fx.buyer.id, action: 'report.create', targetType: 'report', targetId: listingReport.id,
      } })).toBe(1);
      const store = await request(app).post(url).set(token(fx.buyer.id))
        .send({ sellerProfileId: fx.store.id, reason });
      expect(store.status).toBe(201);
      const storeReport = await prisma.report.findUniqueOrThrow({ where: { id: store.body.id } });
      expect(storeReport).toMatchObject({
        reporterUserId: fx.buyer.id, listingId: null, sellerProfileId: fx.store.id, reason,
      });
      expect(await prisma.auditLog.count({ where: {
        action: 'report.create', targetType: 'report', targetId: storeReport.id,
      } })).toBe(1);
    });

    test('real authentication, validation and nonpublic/own-target denials never create report or audit', async () => {
      const originalReports = await prisma.report.count();
      const originalAudits = await prisma.auditLog.count();
      const submit = (payload: Record<string, unknown>, as?: number) => {
        const req = request(app).post(url).send(payload);
        return as === undefined ? req : req.set(token(as));
      };
      expect((await submit({ listingId: fx.published.id, reason })).status).toBe(401);
      expect((await submit({ listingId: fx.published.id, reason }, fx.reviewerA.id)).status).toBe(403);
      expect((await submit({ listingId: fx.published.id, reason }, fx.seller.id)).status).toBe(400);
      expect((await submit({ sellerProfileId: fx.store.id, reason }, fx.seller.id)).status).toBe(400);
      expect((await submit({ listingId: fx.draft.id, reason }, fx.buyer.id)).status).toBe(404);
      expect((await submit({ sellerProfileId: 2147483647, reason }, fx.buyer.id)).status).toBe(404);
      expect((await submit({ listingId: fx.published.id, sellerProfileId: fx.store.id, reason }, fx.buyer.id)).status).toBe(400);
      expect((await submit({ listingId: fx.published.id, reason, reporterUserId: fx.seller.id }, fx.buyer.id)).status).toBe(400);
      expect((await submit({ messageId: 10, reason }, fx.buyer.id)).status).toBe(400);
      const deleted = await prisma.listing.create({ data: {
        sellerProfileId: fx.store.id, campusId: fx.campusA.id,
        categoryId: fx.category.id, type: 'physical_product', title: 'Deleted synthetic listing',
        description: 'Guarded test-only deleted listing', price: 31, status: 'published', deletedAt: new Date(),
      } });
      expect((await submit({ listingId: deleted.id, reason }, fx.buyer.id)).status).toBe(404);
      const suspendedStore = await prisma.sellerProfile.create({ data: {
        ownerUserId: fx.suspended.id, campusId: fx.campusA.id,
        storeName: 'Suspended Synthetic Store', description: 'Test-only inactive owner store',
        approvalStatus: 'approved',
      } });
      expect((await submit({ sellerProfileId: suspendedStore.id, reason }, fx.buyer.id)).status).toBe(404);
      expect(await prisma.report.count()).toBe(originalReports);
      expect(await prisma.auditLog.count()).toBe(originalAudits);
    });

    test('campus reviewers only see/resolve same-campus reports; global admin can view both', async () => {
      const a = await request(app).post(url).set(token(fx.outsider.id))
        .send({ listingId: fx.published.id, reason: 'Synthetic campus A complaint' });
      const b = await request(app).post(url).set(token(fx.buyer.id))
        .send({ listingId: fx.otherPublished.id, reason: 'Synthetic campus B complaint' });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      const fetchIds = async (userId: number) => {
        const res = await request(app).get(adminUrl).set(token(userId));
        expect(res.status).toBe(200);
        return (res.body as Array<{id:number}>).map(r => r.id);
      };
      const campusA = await fetchIds(fx.reviewerA.id);
      const campusB = await fetchIds(fx.reviewerB.id);
      const global = await fetchIds(fx.globalAdmin.id);
      expect(campusA).toContain(a.body.id);
      expect(campusA).not.toContain(b.body.id);
      expect(campusB).toContain(b.body.id);
      expect(campusB).not.toContain(a.body.id);
      expect(global).toContain(a.body.id);
      expect(global).toContain(b.body.id);
      const resolve = adminUrl + '/' + a.body.id + '/resolve';
      expect((await request(app).post(resolve).set(token(fx.reviewerB.id))
        .send({ status: 'dismissed', reason: 'Outside-campus reviewer must be rejected' })).status).toBe(404);
      expect((await request(app).post(resolve).set(token(fx.reviewerA.id))
        .send({ status: 'resolved', reason: 'Reviewed and resolved the synthetic listing complaint' })).status).toBe(204);
      expect((await prisma.report.findUniqueOrThrow({ where: { id: a.body.id } })).status).toBe('resolved');
      expect(await prisma.auditLog.count({ where: {
        action: 'report.resolved', actorUserId: fx.reviewerA.id, targetId: a.body.id,
      } })).toBe(1);
      expect((await request(app).post(resolve).set(token(fx.reviewerA.id))
        .send({ status: 'resolved', reason: 'Repeated resolution must be rejected for this report' })).status).toBe(409);
    });

    test('a real MySQL transaction rolls back a created report if an audit write fails', async () => {
      const rollbackReason = 'Synthetic forced audit failure rollback proof';
      const before = await prisma.report.count({ where: { reason: rollbackReason } });
      const failure = await prisma.$transaction(async tx => {
        const failedAuditTx = {
          report: tx.report,
          auditLog: { create: async () => { throw new Error('synthetic audit insert failed'); } },
        } as unknown as Prisma.TransactionClient;
        await createAuditedPublicReport(failedAuditTx, fx.buyer.id,
          { listingId: fx.published.id }, rollbackReason);
      }).then(() => null, e => e);
      expect(failure).toBeInstanceOf(Error);
      expect(String((failure as Error).message)).toContain('synthetic audit insert failed');
      expect(await prisma.report.count({ where: { reason: rollbackReason } })).toBe(before);
    });
  });
} else {
  describe.skip('B2a.3 isolated reports (run with bun run test:integration)', () => {
    test('opt-in only; no database access under ordinary test', () => {});
  });
}
