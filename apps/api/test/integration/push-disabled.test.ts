import { afterAll, beforeAll, describe, expect, test } from 'bun:test';

/**
 * Execute only through the isolated push integration runner with both switches off.
 * Does not call browser push services or write to the development database.
 */
if (process.env.CPSU_PUSH_DISABLED_TESTS === '1') {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (process.env.NODE_ENV !== 'test' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
    || decodeURIComponent(url.pathname.slice(1)) !== 'cpsu_marketplace_push_test'
    || process.env.PUSH_SUBSCRIPTIONS_ENABLED !== 'false'
    || process.env.PUSH_DELIVERY_ENABLED !== 'false') {
    throw new Error('Fail-closed push HTTP tests require the isolated local TEST schema and both switches off.');
  }
  const { PrismaClient } = await import('@prisma/client');
  const request = (await import('supertest')).default;
  const { signAccess } = await import('../../src/auth.js');
  const { createApp } = await import('../../src/app.js');
  const prisma = new PrismaClient();
  const app = createApp();
  let accountId = 0;
  const endpoint = 'https://fcm.googleapis.com/fcm/send/cpsu-fail-closed-synthetic';
  const subscription = { endpoint, keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } };
  const headers = () => ({ Authorization: 'Bearer ' + signAccess(accountId) });

  describe('Web Push Stage 5 API fails closed with remote sending disabled', () => {
    beforeAll(async () => {
      const account = await prisma.user.create({
        data: {
          email: 'stage5-off-' + Date.now() + '@example.invalid',
          displayName: 'Synthetic Push Disabled QA',
          passwordHash: 'test-only-not-a-real-login',
        },
      });
      accountId = account.id;
    });
    afterAll(async () => {
      if (accountId) {
        await prisma.pushSubscription.deleteMany({ where: { userId: accountId } });
        await prisma.pushPreference.deleteMany({ where: { userId: accountId } });
        await prisma.user.delete({ where: { id: accountId } });
      }
      await prisma.$disconnect();
    });

    test('authenticated configuration returns disabled and hides the public key', async () => {
      const reply = await request(app).get('/api/v1/push/config').set(headers());
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.body).toEqual({ enabled: false, deliveryEnabled: false, publicKey: null });
    });

    test('enrollment and preference writes cannot proceed when the gate is off', async () => {
      const register = await request(app).post('/api/v1/push/subscriptions')
        .set(headers()).send(subscription);
      expect(register.status).toBe(503);
      const preferences = await request(app).patch('/api/v1/push/preferences')
        .set(headers()).send({ messages: false });
      expect(preferences.status).toBe(503);
      expect(await prisma.pushSubscription.count({ where: { userId: accountId } })).toBe(0);
      expect(await prisma.pushPreference.count({ where: { userId: accountId } })).toBe(0);
    });

    test('safe opt-out remains available while new opt-in is disabled', async () => {
      const reply = await request(app).delete('/api/v1/push/subscriptions')
        .set(headers()).send({ endpoint });
      expect(reply.status).toBe(204);
      const prefs = await request(app).get('/api/v1/push/preferences').set(headers());
      expect(prefs.status).toBe(200);
      expect(prefs.body).toEqual({ messages: true, listingReviews: true, accountUpdates: true });
    });
  });
} else {
  describe.skip('Isolated Web Push fail-closed HTTP tests (opt-in)', () => {
    test('run bun run test:push:integration', () => {});
  });
}
