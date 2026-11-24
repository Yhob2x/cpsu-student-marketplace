import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import request from 'supertest';
import { assertIsolatedTestDatabase, resetFixtures, seedFixtures } from './fixtures.js';

// Opt-in only. Never import app/prisma before validating the TEST database guard.
// Runs SEQUENTIALLY after other fixtures, never as part of ordinary 'bun test'.
if (process.env.CPSU_INTEGRATION_TESTS === '1') {
  assertIsolatedTestDatabase();
  const { createApp } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const { hashPassword, signAccess } = await import('../../src/auth.js');
  // Each independent phase gets a fresh, unmodified production-style limiter instance.
  // This avoids cumulative test-phase 429s without disabling HTTP rate limiting.
  let app = createApp();
  type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
  let fx: Fixtures;
  const base = '/api/v1/inquiries';
  const token = (id: number) => ({ Authorization: 'Bearer ' + signAccess(id) });
  let unique = 0;
  let conflicts = 0;
  let successMessages = 0;
  const durations: number[] = [];
  const requestThread = async () => {
    assertIsolatedTestDatabase();
    const n = ++unique;
    const listing = await prisma.listing.create({ data: {
      sellerProfileId: fx.store.id, campusId: fx.campusA.id,
      categoryId: fx.category.id, type: 'physical_product', status: 'published',
      title: 'Synthetic concurrency case ' + n,
      description: 'Private test-only listing for controlled MySQL concurrency',
      price: 47,
    } });
    const started = await request(app).post(base).set(token(fx.buyer.id))
      .send({ listingId: listing.id, body: 'Synthetic starting message for concurrency' });
    expect(started.status).toBe(201);
    return { id: started.body.id as number, listingId: listing.id };
  };
  function expectedConflict(response: { status: number; body: any }) {
    if (response.status === 409) {
      expect(['thread_closed', 'concurrent_transaction_conflict']).toContain(response.body.error?.code);
      if (response.body.error?.code === 'concurrent_transaction_conflict') conflicts++;
      return;
    }
    expect(response.status).toBe(201);
    successMessages++;
  }
  async function ensureClosed(id: number, first: { status: number; body: any }) {
    if (first.status === 409) {
      expect(first.body.error?.code).toBe('concurrent_transaction_conflict');
      conflicts++;
      const retry = await request(app).post(base + '/' + id + '/close').set(token(fx.buyer.id));
      expect(retry.status).toBe(204);
    } else expect(first.status).toBe(204);
    expect((await prisma.inquiryThread.findUniqueOrThrow({ where: { id } })).status).toBe('closed');
    expect(await prisma.auditLog.count({ where: {
      action: 'inquiry.closed', targetType: 'inquiry_thread', targetId: id,
    } })).toBe(1);
  }

  describe('B1.3 bounded conversation contention stress — synthetic local MySQL only', () => {
    beforeAll(async () => {
      assertIsolatedTestDatabase();
      await resetFixtures(prisma);
      fx = await seedFixtures(prisma, hashPassword);
    });
    afterAll(async () => {
      assertIsolatedTestDatabase();
      try { await resetFixtures(prisma); } finally { await prisma.$disconnect(); }
    });

    test('40 send-vs-close rounds, three concurrent sends per thread, never admit late messages', async () => {
      app = createApp();
      for (let n = 0; n < 40; n++) {
        const { id, listingId } = await requestThread();
        const msgCount = await prisma.inquiryMessage.count({ where: { threadId: id } });
        const notifyCount = await prisma.notification.count();
        const start = Date.now();
        const [a,b,c,close] = await Promise.all([
          ...[0,1,2].map(i => request(app).post(base + '/' + id + '/messages')
            .set(token(fx.seller.id)).send({ body: 'Contention #' + n + '/' + i })),
          request(app).post(base + '/' + id + '/close').set(token(fx.buyer.id)),
        ]);
        durations.push(Date.now() - start);
        const accepted = [a,b,c].filter(r => r.status === 201).length;
        [a,b,c].forEach(expectedConflict);
        await ensureClosed(id, close);
        expect(await prisma.inquiryMessage.count({ where: { threadId: id } })).toBe(msgCount + accepted);
        expect(await prisma.notification.count()).toBe(notifyCount + accepted);
        // A successful close is an absolute barrier for both message entry points.
        const late = await request(app).post(base + '/' + id + '/messages')
          .set(token(fx.seller.id)).send({ body: 'After closure' });
        expect(late.status).toBe(409);
        expect(late.body.error.code).toBe('thread_closed');
        const bypass = await request(app).post(base).set(token(fx.buyer.id))
          .send({ listingId, body: 'After closure shortcut' });
        expect(bypass.status).toBe(409);
        expect(bypass.body.error.code).toBe('thread_closed');
        expect(await prisma.inquiryMessage.count({ where: { threadId: id } })).toBe(msgCount + accepted);
      }
    });

    test('20 simultaneous buyer/seller close rounds remain idempotent and singly audited', async () => {
      app = createApp();
      for (let n=0; n<20; n++) {
        const { id } = await requestThread();
        const [a,b] = await Promise.all([
          request(app).post(base + '/' + id + '/close').set(token(fx.buyer.id)),
          request(app).post(base + '/' + id + '/close').set(token(fx.seller.id)),
        ]);
        for (const result of [a,b]) {
          if (result.status === 409) {
            expect(result.body.error.code).toBe('concurrent_transaction_conflict');
            conflicts++;
          } else expect(result.status).toBe(204);
        }
        await ensureClosed(id, a);
        // Closure remains idempotent after any racing conflict resolution.
        expect((await request(app).post(base + '/' + id + '/close')
          .set(token(fx.seller.id))).status).toBe(204);
        expect(await prisma.auditLog.count({ where: {
          action: 'inquiry.closed', targetType: 'inquiry_thread', targetId: id,
        } })).toBe(1);
      }
    });

    test('10 waves of post-close replay produce zero writes or notifications', async () => {
      app = createApp();
      for (let n=0; n<10; n++) {
        const { id, listingId } = await requestThread();
        const beforeMessages = await prisma.inquiryMessage.count({ where: { threadId: id } });
        expect((await request(app).post(base + '/' + id + '/close')
          .set(token(fx.buyer.id))).status).toBe(204);
        const beforeNotifies = await prisma.notification.count();
        const replies = await Promise.all([
          ...Array.from({ length: 4 }, (_, i) => request(app).post(base + '/' + id + '/messages')
            .set(token(i%2 ? fx.buyer.id : fx.seller.id)).send({ body: 'Late synthetic replay' })),
          ...Array.from({ length: 4 }, () => request(app).post(base).set(token(fx.buyer.id))
            .send({ listingId, body: 'Late synthetic shortcut' })),
          request(app).post(base + '/' + id + '/typing').set(token(fx.seller.id)),
          request(app).post(base + '/' + id + '/presence').set(token(fx.buyer.id)),
        ]);
        expect(replies).toHaveLength(10);
        for (const response of replies) {
          expect(response.status).toBe(409);
          expect(response.body.error.code).toBe('thread_closed');
        }
        expect(await prisma.inquiryMessage.count({ where: { threadId: id } })).toBe(beforeMessages);
        expect(await prisma.notification.count()).toBe(beforeNotifies);
      }
      const sorted = [...durations].sort((a,b)=>a-b);
      console.log('B1.3 bounded stress summary (synthetic only): ' +
        JSON.stringify({ raceRounds: 40, doubleCloseRounds: 20, postCloseWaves: 10,
          contestedSendResponses: 120, successfulContestedSends: successMessages,
          concurrencyConflicts: conflicts, raceElapsedMsP95: sorted[Math.ceil(sorted.length*.95)-1],
          raceElapsedMsMax: sorted.at(-1) }));
    });

    test('bounded public reads do not starve writes while liveness remains available', async () => {
      // Use the actual middleware, not an isolated limiter stub. This test was
      // updated after GET and mutation budgets were separated for campus NATs.
      const limited = createApp();
      const reads = await Promise.all(Array.from({ length: 902 }, () =>
        request(limited).get('/api/v1/unused-synthetic-route')));
      expect(reads.filter(response => response.status === 404)).toHaveLength(900);
      expect(reads.filter(response => response.status === 429)).toHaveLength(2);
      expect((await request(limited).get('/health')).status).toBe(200);
      // The read budget cannot consume a mutation's independently bounded quota.
      expect((await request(limited).post('/api/v1/unused-synthetic-route')).status).toBe(404);
    });
  });
} else {
  describe.skip('B1.3 bounded local MySQL stress (opt-in test:integration only)', () => {
    test('ordinary unit run opens no database', () => {});
  });
}
