import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import { assertIsolatedTestDatabase, resetFixtures, seedFixtures } from './fixtures.js';

// This entire suite is opt-in. Only the local test database may receive synthetic
// users, uploads, reviews, follower notifications, messages or transactions.
if (process.env.CPSU_INTEGRATION_TESTS === '1') {
  assertIsolatedTestDatabase();
  const { createApp } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const { hashPassword } = await import('../../src/auth.js');
  const { DEFAULT_HOME_PAGE } = await import('../../src/home-page-content.js');
  const sharp = (await import('sharp')).default;
  const app = createApp();
  type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
  let fx: Fixtures;
  const password = 'TestPassphrase-Stage1-2026!';
  const api = '/api/v1';

  async function login(email: string) {
    const response = await request(app).post(api + '/auth/login')
      .send({ email, password });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie']?.some((cookie: string) => cookie.startsWith('refresh='))).toBe(true);
    return {
      user: { Authorization: 'Bearer ' + response.body.accessToken },
      cookie: response.headers['set-cookie'].find((cookie: string) => cookie.startsWith('refresh=')).split(';')[0] as string,
    };
  }

  describe('P1 authenticated multi-role journey (isolated synthetic MySQL only)', () => {
    beforeAll(async () => {
      await resetFixtures(prisma);
      fx = await seedFixtures(prisma, hashPassword);
    });
    afterAll(async () => {
      await resetFixtures(prisma);
      await prisma.$disconnect();
    });

    test('real login -> follow -> listing draft -> photo -> campus review -> chat -> mutual transaction completion', async () => {
      const buyer = await login(fx.buyer.email);
      const seller = await login(fx.seller.email);
      const reviewer = await login(fx.reviewerA.email);
      const outOfCampus = await login(fx.reviewerB.email);
      const university = await login(fx.globalAdmin.email);

      const sellerProfile = await request(app).get(api + '/seller/store').set(seller.user);
      expect(sellerProfile.status).toBe(200);
      expect(sellerProfile.body.id).toBe(fx.store.id);
      const follow = await request(app).put(api + '/store-follows/' + fx.store.id).set(buyer.user).send({});
      expect(follow.status).toBe(200);
      expect(follow.body).toMatchObject({ isFollowing: true, count: 1 });
      const privateFollowers = await request(app).get(api + '/store-follows/mine').set(seller.user);
      expect(privateFollowers.status).toBe(200);
      expect(privateFollowers.body.items.some((item: any) => item.displayName === fx.buyer.displayName)).toBe(true);
      expect(JSON.stringify(privateFollowers.body)).not.toContain(fx.buyer.email);

      const listing = await request(app).post(api + '/seller/listings').set(seller.user).send({
        type: 'physical_product', categoryId: fx.category.id,
        title: 'P1 Synthetic Campus Item', description: 'Synthetic marketplace acceptance item, not a real offer.',
        price: 275, priceBasis: 'per item', condition: 'good',
      });
      expect(listing.status).toBe(201);
      const listingId = listing.body.id as number;
      const detail = api + '/listings/' + listingId;
      expect((await request(app).get(detail)).status).toBe(404); // draft stays private

      const pixels = await sharp({ create: {
        width: 48, height: 32, channels: 3, background: '#729a78',
      } }).png().toBuffer();
      const photo = await request(app).post(api + '/seller/listings/' + listingId + '/media')
        .set(seller.user).attach('image', pixels, { filename: 'p1-synthetic.png', contentType: 'image/png' });
      expect(photo.status).toBe(201);
      expect((await request(app).get(detail)).status).toBe(404);

      const submitted = await request(app).post(api + '/seller/listings/' + listingId + '/submit')
        .set(seller.user).send({});
      expect(submitted.status).toBe(200);
      expect(submitted.body.status).toBe('pending_review');
      const reviewerQueue = await request(app).get(api + '/admin/review-queue').set(reviewer.user);
      expect(reviewerQueue.status).toBe(200);
      expect(reviewerQueue.body.listings.some((item: any) => item.id === listingId)).toBe(true);
      const foreignQueue = await request(app).get(api + '/admin/review-queue').set(outOfCampus.user);
      expect(foreignQueue.status).toBe(200);
      expect(foreignQueue.body.listings.some((item: any) => item.id === listingId)).toBe(false);
      const reviewEndpoint = api + '/admin/listings/' + listingId + '/decision';
      expect((await request(app).post(reviewEndpoint).set(outOfCampus.user)
        .send({ decision: 'approved', reason: 'Photos inspected', photosReviewed: true })).status).toBe(404);
      expect((await request(app).post(reviewEndpoint).set(reviewer.user)
        .send({ decision: 'approved', reason: 'Photos inspected' })).status).toBe(422);
      const published = await request(app).post(reviewEndpoint).set(reviewer.user)
        .send({ decision: 'approved', reason: 'Photos inspected', photosReviewed: true });
      expect(published.status).toBe(200);
      expect(published.body.status).toBe('published');
      const publicListing = await request(app).get(detail);
      expect(publicListing.status).toBe(200);
      expect(publicListing.body.title).toBe('P1 Synthetic Campus Item');
      expect(publicListing.body.images).toHaveLength(1);
      const followerNotice = await prisma.notification.findFirst({
        where: { userId: fx.buyer.id, type: 'store.new_listing' },
      });
      expect(followerNotice).not.toBeNull();

      const newInquiry = await request(app).post(api + '/inquiries').set(buyer.user)
        .send({ listingId, body: 'Is the synthetic campus item available for a test meetup?' });
      expect(newInquiry.status).toBe(201);
      const threadId = newInquiry.body.id as number;
      const sellerInbox = await request(app).get(api + '/inquiries').set(seller.user);
      expect(sellerInbox.status).toBe(200);
      expect(sellerInbox.body.some((item: any) => item.id === threadId)).toBe(true);
      const reply = await request(app).post(api + '/inquiries/' + threadId + '/messages')
        .set(seller.user).send({ body: 'Yes, for the synthetic acceptance test.' });
      expect(reply.status).toBe(201);
      const buyerMessages = await request(app).get(api + '/inquiries/' + threadId + '/messages').set(buyer.user);
      expect(buyerMessages.status).toBe(200);
      expect(buyerMessages.body.messages.some((item: any) => item.body === 'Yes, for the synthetic acceptance test.')).toBe(true);

      const requested = await request(app).post(api + '/transactions').set(buyer.user).send({ listingId });
      expect(requested.status).toBe(201);
      expect(requested.body.status).toBe('pending');
      const txId = requested.body.id as number;
      expect((await request(app).get(api + '/transactions/' + txId).set(outOfCampus.user)).status).toBe(403);
      const approved = await request(app).post(api + '/transactions/' + txId + '/decision')
        .set(seller.user).send({ action: 'accept' });
      expect(approved.status).toBe(200);
      expect(approved.body.status).toBe('accepted');
      for (const participant of [buyer.user, seller.user]) {
        const meetup = await request(app).post(api + '/transactions/' + txId + '/confirm-meetup')
          .set(participant).send({});
        expect(meetup.status).toBe(200);
      }
      for (const participant of [seller.user, buyer.user]) {
        const completion = await request(app).post(api + '/transactions/' + txId + '/confirm-completion')
          .set(participant).send({});
        expect(completion.status).toBe(200);
      }
      const finished = await request(app).get(api + '/transactions/' + txId).set(buyer.user);
      expect(finished.status).toBe(200);
      expect(finished.body.status).toBe('completed');
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).availabilityState).toBe('sold');
      const monitoring = await request(app).get(api + '/admin/transactions').set(university.user);
      expect(monitoring.status).toBe(200);
      expect(monitoring.body.items.some((item: any) => item.id === txId)).toBe(true);
      expect(JSON.stringify(monitoring.body)).not.toContain('Test buyer@stage1.invalid');

      // Real cookie/session revocation, not a mocked frontend sign-out.
      expect((await request(app).post(api + '/auth/logout').set('Cookie', buyer.cookie).send({})).status).toBe(204);
      expect((await request(app).post(api + '/auth/refresh').set('Cookie', buyer.cookie)).status).toBe(204);
    });

    test('global admin logs in and keeps homepage edits private until publication, reviewer cannot publish', async () => {
      const university = await login(fx.globalAdmin.email);
      const reviewer = await login(fx.reviewerA.email);
      const before = await request(app).get(api + '/home-page');
      expect(before.status).toBe(200);
      expect(before.body.copy.heroLine1).toBe(DEFAULT_HOME_PAGE.copy.heroLine1);
      const endpoint = api + '/admin/content/home-page';
      expect((await request(app).get(endpoint).set(reviewer.user)).status).toBe(403);
      const editor = await request(app).get(endpoint).set(university.user);
      expect(editor.status).toBe(200);
      const draft = await request(app).put(endpoint).set(university.user).send({
        expectedRevision: editor.body.revision,
        copy: { ...editor.body.draft.copy, heroLine1: 'P1 Synthetic published headline' },
      });
      expect(draft.status).toBe(200);
      expect(draft.body.revision).toBe(editor.body.revision + 1);
      expect((await request(app).get(api + '/home-page')).body.copy.heroLine1).toBe(DEFAULT_HOME_PAGE.copy.heroLine1);
      expect((await request(app).post(endpoint + '/publish').set(reviewer.user)
        .send({ expectedRevision: draft.body.revision })).status).toBe(403);
      const published = await request(app).post(endpoint + '/publish').set(university.user)
        .send({ expectedRevision: draft.body.revision });
      expect(published.status).toBe(200);
      expect(published.body.publishedRevision).toBe(draft.body.revision);
      expect((await request(app).get(api + '/home-page')).body.copy.heroLine1)
        .toBe('P1 Synthetic published headline');
    });
  });
} else {
  describe.skip('P1 real-login isolated acceptance', () => {
    test('requires the guarded integration runner', () => {});
  });
}
