import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import request from 'supertest';
import { assertIsolatedTestDatabase, resetFixtures, seedFixtures } from './fixtures.js';

// Do not import the app, environment or Prisma connection before both test gates.
// Ordinary "bun test" must skip without opening any database or writing fixtures.
if (process.env.CPSU_INTEGRATION_TESTS === '1') {
  assertIsolatedTestDatabase();
  const { createApp } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const { hashPassword, signAccess } = await import('../../src/auth.js');
  const app = createApp();
  type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
  let fx: Fixtures;
  const token = (id: number) => ({ Authorization: 'Bearer ' + signAccess(id) });
  const base = '/api/v1/inquiries';
  const createThread = async (listingId: number) => {
    const response = await request(app).post(base).set(token(fx.buyer.id))
      .send({ listingId, body: 'Hello, this is a synthetic test inquiry' });
    expect(response.status).toBe(201);
    return response.body.id as number;
  };
  const newListing = async (ordinal: number) =>
    prisma.listing.create({ data: {
      sellerProfileId: fx.store.id, campusId: fx.campusA.id,
      categoryId: fx.category.id, type: 'physical_product',
      title: 'Conversation closure race ' + ordinal,
      description: 'Synthetic isolated test listing for close vs send',
      price: 120, status: 'published',
    } });

  describe('B1.2 — real MySQL conversation closure and send safety', () => {
    beforeAll(async () => {
      assertIsolatedTestDatabase();
      await resetFixtures(prisma);
      fx = await seedFixtures(prisma, hashPassword);
    });
    afterAll(async () => {
      assertIsolatedTestDatabase();
      try { await resetFixtures(prisma); }
      finally { await prisma.$disconnect(); }
    });

    test('only buyer and seller can close; close is idempotent and audited exactly once', async () => {
      const id = await createThread(fx.published.id);
      const close = base + '/' + id + '/close';
      expect((await request(app).post(close)).status).toBe(401);
      expect((await request(app).post(close).set(token(fx.outsider.id))).status).toBe(404);
      expect((await request(app).post(close).set(token(fx.reviewerA.id))).status).toBe(403);
      expect((await request(app).post(base + '/bad/close').set(token(fx.seller.id))).status).toBe(400);
      expect((await prisma.inquiryThread.findUniqueOrThrow({ where: { id } })).status).toBe('open');
      expect((await request(app).post(close).set(token(fx.buyer.id))).status).toBe(204);
      expect((await request(app).post(close).set(token(fx.buyer.id))).status).toBe(204);
      expect((await request(app).post(close).set(token(fx.seller.id))).status).toBe(204);
      expect((await prisma.inquiryThread.findUniqueOrThrow({ where: { id } })).status).toBe('closed');
      expect(await prisma.auditLog.count({ where: {
        action: 'inquiry.closed', targetType: 'inquiry_thread', targetId: id,
      } })).toBe(1);
      const history = await request(app).get(base + '/' + id + '/messages').set(token(fx.seller.id));
      expect(history.status).toBe(200);
      expect(history.body.thread.status).toBe('closed');
      expect(history.body.messages).toHaveLength(1);
      const buyerHistory = await request(app).get(base + '/' + id + '/messages').set(token(fx.buyer.id));
      expect(buyerHistory.status).toBe(200);
      expect(buyerHistory.body.messages).toHaveLength(1);
      expect((await request(app).get(base + '/' + id + '/messages').set(token(fx.outsider.id))).status).toBe(404);
    });

    test('both participants and the inquiry-create shortcut cannot send or notify after close', async () => {
      const listing = await newListing(1);
      const id = await createThread(listing.id);
      expect((await request(app).post(base + '/' + id + '/close').set(token(fx.seller.id))).status).toBe(204);
      const priorMessages = await prisma.inquiryMessage.count({ where: { threadId: id } });
      const priorNotifications = await prisma.notification.count();
      const asBuyer = await request(app).post(base + '/' + id + '/messages')
        .set(token(fx.buyer.id)).send({ body: 'Buyer message after closure' });
      expect(asBuyer.status).toBe(409);
      expect(asBuyer.body.error.code).toBe('thread_closed');
      const asSeller = await request(app).post(base + '/' + id + '/messages')
        .set(token(fx.seller.id)).send({ body: 'Seller message after closure' });
      expect(asSeller.status).toBe(409);
      expect(asSeller.body.error.code).toBe('thread_closed');
      const bypass = await request(app).post(base).set(token(fx.buyer.id))
        .send({ listingId: listing.id, body: 'Trying the shortcut after closure' });
      expect(bypass.status).toBe(409);
      expect(bypass.body.error.code).toBe('thread_closed');
      expect(await prisma.inquiryMessage.count({ where: { threadId: id } })).toBe(priorMessages);
      expect(await prisma.notification.count()).toBe(priorNotifications);
    });

    test('a closed conversation rejects fresh typing and in-chat presence signals', async () => {
      const listing = await newListing(2);
      const id = await createThread(listing.id);
      const prefix = base + '/' + id;
      expect((await request(app).post(prefix + '/typing').set(token(fx.buyer.id))).status).toBe(204);
      expect((await request(app).post(prefix + '/presence').set(token(fx.seller.id))).status).toBe(204);
      expect((await request(app).post(prefix + '/close').set(token(fx.buyer.id))).status).toBe(204);
      for (const participant of [fx.buyer.id, fx.seller.id]) {
        const typing = await request(app).post(prefix + '/typing').set(token(participant));
        expect(typing.status).toBe(409);
        expect(typing.body.error.code).toBe('thread_closed');
        const presence = await request(app).post(prefix + '/presence').set(token(participant));
        expect(presence.status).toBe(409);
        expect(presence.body.error.code).toBe('thread_closed');
      }
      const history = await request(app).get(prefix + '/messages').set(token(fx.buyer.id));
      expect(history.status).toBe(200);
      expect(history.body.typing).toBe(false);
      expect(history.body.otherActiveInChat).toBe(false);
    });

    test('concurrent send and close never allow a new message after close commits', async () => {
      // Separate threads make each race independent and avoid cross-test fixture conflicts.
      for (let attempt = 0; attempt < 5; attempt++) {
        const listing = await newListing(100 + attempt);
        const id = await createThread(listing.id);
        const url = base + '/' + id;
        const countBefore = await prisma.inquiryMessage.count({ where: { threadId: id } });
        const [send, closing] = await Promise.all([
          request(app).post(url + '/messages').set(token(fx.seller.id))
            .send({ body: 'Seller racing close #' + attempt }),
          request(app).post(url + '/close').set(token(fx.buyer.id)),
        ]);
        expect([201, 409]).toContain(send.status);
        if (send.status === 409) {
          expect(['thread_closed', 'concurrent_transaction_conflict']).toContain(send.body.error.code);
        }
        // Serializable transactions can deadlock instead of silently admitting stale data;
        // a retried close is safe and must remain idempotent.
        expect([204, 409]).toContain(closing.status);
        if (closing.status === 409) expect(closing.body.error.code).toBe('concurrent_transaction_conflict');
        const afterRace = await prisma.inquiryMessage.count({ where: { threadId: id } });
        expect(afterRace).toBe(countBefore + (send.status === 201 ? 1 : 0));
        if (closing.status === 409) {
          expect((await request(app).post(url + '/close').set(token(fx.buyer.id))).status).toBe(204);
        }
        expect((await prisma.inquiryThread.findUniqueOrThrow({ where: { id } })).status).toBe('closed');
        expect(await prisma.auditLog.count({ where: {
          action: 'inquiry.closed', targetType: 'inquiry_thread', targetId: id,
        } })).toBe(1);
        const noLateSend = await request(app).post(url + '/messages')
          .set(token(fx.seller.id)).send({ body: 'Must never append after close' });
        expect(noLateSend.status).toBe(409);
        expect(noLateSend.body.error.code).toBe('thread_closed');
        expect(await prisma.inquiryMessage.count({ where: { threadId: id } })).toBe(afterRace);
      }
    });
  });
} else {
  describe.skip('B1.2 isolated conversation close (run with bun run test:integration)', () => {
    test('opt-in only; no database access during ordinary tests', () => {});
  });
}
