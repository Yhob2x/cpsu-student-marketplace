import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

if (process.env.CPSU_PUSH_TESTS === '1') {
  const { PrismaClient } = await import('@prisma/client');
  const request = (await import('supertest')).default;
  const { createApp } = await import('../../src/app.js');
  const { signAccess } = await import('../../src/auth.js');
  const { notify } = await import('../../src/audit.js');

  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
    || url.pathname !== '/cpsu_marketplace_push_test'
    || process.env.NODE_ENV !== 'test') {
    throw new Error('Refusing push integration outside the dedicated local push test schema.');
  }
  const prisma = new PrismaClient();
  const app = createApp();
  let a: number;
  let b: number;
  let threadId: number | null = null;
  let listingId: number | null = null;
  let sellerId: number | null = null;
  let categoryId: number | null = null;
  let campusId: number | null = null;
  const auth = (id: number) => ({ Authorization: 'Bearer ' + signAccess(id) });
  const fakeEndpoint = 'https://fcm.googleapis.com/fcm/send/synthetic-push-test-token';
  const sub = { endpoint: fakeEndpoint, expirationTime: null, keys: {
    p256dh: 'A'.repeat(87), auth: 'B'.repeat(22),
  } };

  describe('Web Push HTTP authorization and MySQL persistence — isolated', () => {
    beforeAll(async () => {
      const nonce = Date.now().toString();
      const first = await prisma.user.create({
        data: { email: 'pushqa-a-' + nonce + '@example.invalid', displayName: 'Push QA A', passwordHash: 'synthetic-test-only' },
      });
      const second = await prisma.user.create({
        data: { email: 'pushqa-b-' + nonce + '@example.invalid', displayName: 'Push QA B', passwordHash: 'synthetic-test-only' },
      });
      a = first.id;
      b = second.id;
    });

    afterAll(async () => {
      if (threadId) {
        await prisma.inquiryMessage.deleteMany({ where: { threadId } });
        await prisma.inquiryThread.delete({ where: { id: threadId } });
      }
      if (listingId) await prisma.listing.delete({ where: { id: listingId } });
      if (sellerId) await prisma.sellerProfile.delete({ where: { id: sellerId } });
      if (categoryId) await prisma.category.delete({ where: { id: categoryId } });
      if (campusId) await prisma.campus.delete({ where: { id: campusId } });
      if (a && b) {
        await prisma.pushSubscription.deleteMany({ where: { userId: { in: [a, b] } } });
        await prisma.pushPreference.deleteMany({ where: { userId: { in: [a, b] } } });
        await prisma.notification.deleteMany({ where: { userId: { in: [a, b] } } });
        await prisma.user.deleteMany({ where: { id: { in: [a, b] } } });
      }
      await prisma.$disconnect();
    });

    test('all push configuration, preferences, and subscription routes require a login', async () => {
      for (const path of ['/api/v1/push/config', '/api/v1/push/preferences']) {
        const res = await request(app).get(path);
        expect(res.status).toBe(401);
      }
      const subRes = await request(app).post('/api/v1/push/subscriptions').send(sub);
      expect(subRes.status).toBe(401);
    });

    test('config exposes only the public VAPID key and preferences default to enabled categories', async () => {
      const cfg = await request(app).get('/api/v1/push/config').set(auth(a));
      expect(cfg.status).toBe(200);
      expect(cfg.body.enabled).toBe(true);
      expect(cfg.body.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
      expect(JSON.stringify(cfg.body)).not.toContain(process.env.VAPID_PRIVATE_KEY!);
      const prefs = await request(app).get('/api/v1/push/preferences').set(auth(a));
      expect(prefs.body).toEqual({ messages: true, listingReviews: true, accountUpdates: true });
    });

    test('a student changes only their own notification preferences', async () => {
      const res = await request(app).patch('/api/v1/push/preferences')
        .set(auth(a)).send({ messages: false, accountUpdates: false });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ messages: false, listingReviews: true, accountUpdates: false });
      const other = await request(app).get('/api/v1/push/preferences').set(auth(b));
      expect(other.body).toEqual({ messages: true, listingReviews: true, accountUpdates: true });
      const invalid = await request(app).patch('/api/v1/push/preferences')
        .set(auth(a)).send({ marketing: true });
      expect(invalid.status).toBe(400);
    });

    test('rejects localhost push endpoints without making outbound requests', async () => {
      const invalid = await request(app).post('/api/v1/push/subscriptions').set(auth(a))
        .send({ ...sub, endpoint: 'https://localhost/private' });
      expect(invalid.status).toBe(400);
      const badKeys = await request(app).post('/api/v1/push/subscriptions').set(auth(a))
        .send({ ...sub, keys: { p256dh: 'bad', auth: 'bad' } });
      expect(badKeys.status).toBe(400);
    });

    test('registers a private subscription, reassigns it on account switch and scopes deletion', async () => {
      const create = await request(app).post('/api/v1/push/subscriptions').set(auth(a)).send(sub);
      expect(create.status).toBe(201);
      expect(await prisma.pushSubscription.count({ where: { userId: a } })).toBe(1);
      const transfer = await request(app).post('/api/v1/push/subscriptions').set(auth(b)).send(sub);
      expect(transfer.status).toBe(201);
      expect(await prisma.pushSubscription.count({ where: { userId: a } })).toBe(0);
      expect(await prisma.pushSubscription.count({ where: { userId: b } })).toBe(1);
      const wrongOwner = await request(app).delete('/api/v1/push/subscriptions').set(auth(a))
        .send({ endpoint: fakeEndpoint });
      expect(wrongOwner.status).toBe(204);
      expect(await prisma.pushSubscription.count({ where: { userId: b } })).toBe(1);
      const own = await request(app).delete('/api/v1/push/subscriptions').set(auth(b))
        .send({ endpoint: fakeEndpoint });
      expect(own.status).toBe(204);
      expect(await prisma.pushSubscription.count({ where: { userId: b } })).toBe(0);
    });

    test('unread totals and message-only counts are scoped to the authenticated student', async () => {
      await notify(a, 'inquiry.reply', { threadId: 42, listingTitle: 'synthetic-title' });
      await notify(a, 'listing.decision', { listingId: 99, decision: 'approved' });
      await notify(b, 'inquiry.new', { threadId: 44 });
      const own = await request(app).get('/api/v1/notifications/unread-count').set(auth(a));
      expect(own.status).toBe(200);
      expect(own.body).toEqual({ total: 2, messages: 1 });
      const other = await request(app).get('/api/v1/notifications/unread-count').set(auth(b));
      expect(other.body).toEqual({ total: 1, messages: 1 });
      const mark = await request(app).post('/api/v1/notifications/read').set(auth(a)).send({});
      expect(mark.status).toBe(204);
      const cleared = await request(app).get('/api/v1/notifications/unread-count').set(auth(a));
      expect(cleared.body).toEqual({ total: 0, messages: 0 });
      const remains = await request(app).get('/api/v1/notifications/unread-count').set(auth(b));
      expect(remains.body).toEqual({ total: 1, messages: 1 });
    });

    test('reading one visible message clears only its own notification badge', async () => {
      const campus = await prisma.campus.create({
        data: { code: 'PQA' + Date.now().toString().slice(-9), name: 'Synthetic Push QA Campus' },
      });
      campusId = campus.id;
      const category = await prisma.category.create({
        data: { name: 'Synthetic QA services', listingType: 'service' },
      });
      categoryId = category.id;
      const seller = await prisma.sellerProfile.create({
        data: {
          ownerUserId: b, campusId: campus.id, storeName: 'Synthetic QA Seller',
          description: 'Synthetic push message tests only', approvalStatus: 'approved',
        },
      });
      sellerId = seller.id;
      const listing = await prisma.listing.create({
        data: {
          sellerProfileId: seller.id, campusId: campus.id, categoryId: category.id,
          title: 'Synthetic QA listing', description: 'A private isolated QA listing for notification counts',
          price: 100, priceBasis: 'per hour', type: 'service', status: 'published',
        },
      });
      listingId = listing.id;
      const thread = await prisma.inquiryThread.create({
        data: { listingId: listing.id, buyerUserId: a, sellerProfileId: seller.id },
      });
      threadId = thread.id;

      const first = await prisma.inquiryMessage.create({
        data: { threadId: thread.id, authorUserId: b, body: 'Synthetic first message' },
      });
      const second = await prisma.inquiryMessage.create({
        data: { threadId: thread.id, authorUserId: b, body: 'Synthetic second message' },
      });
      await notify(a, 'inquiry.reply', { threadId: thread.id, messageId: first.id });
      await notify(a, 'inquiry.reply', { threadId: thread.id, messageId: second.id });

      let counts = await request(app).get('/api/v1/notifications/unread-count').set(auth(a));
      expect(counts.body.messages).toBe(2);
      const seenFirst = await request(app).post('/api/v1/inquiries/' + thread.id + '/seen')
        .set(auth(a)).send({ upToId: first.id });
      expect(seenFirst.status).toBe(204);
      counts = await request(app).get('/api/v1/notifications/unread-count').set(auth(a));
      expect(counts.body.messages).toBe(1);
      const seenSecond = await request(app).post('/api/v1/inquiries/' + thread.id + '/seen')
        .set(auth(a)).send({ upToId: second.id });
      expect(seenSecond.status).toBe(204);
      counts = await request(app).get('/api/v1/notifications/unread-count').set(auth(a));
      expect(counts.body.messages).toBe(0);
    });
  });
} else {
  describe.skip('Web Push isolated integration (run with bun run test:push:integration)', () => {
    test('opt-in only', () => {});
  });
}
