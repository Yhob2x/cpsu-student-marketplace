import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import request from 'supertest';
import { assertIsolatedTestDatabase, resetFixtures, seedFixtures } from './fixtures.js';

// This module deliberately does not import application env/DB before checking
// the opt-in flag. Ordinary "bun test" never opens an integration database.
if (process.env.CPSU_INTEGRATION_TESTS === '1') {
  assertIsolatedTestDatabase();
  const { createApp } = await import('../../src/app.js');
  const { prisma } = await import('../../src/db.js');
  const { hashPassword, signAccess } = await import('../../src/auth.js');
  const app = createApp();
  type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
  let fx: Fixtures;
  const token = (id: number) => ({ Authorization: 'Bearer ' + signAccess(id) });
  const sample = (categoryId: number) => ({
    type: 'physical_product', categoryId, title: 'Fresh Textbook Stage1',
    description: 'A valid listing used for integration testing', price: 125, priceBasis: 'per item',
  });

  describe('Stage 1 HTTP + database integration (isolated MySQL)', () => {
    beforeAll(async () => {
      await resetFixtures(prisma);
      fx = await seedFixtures(prisma, hashPassword);
    });
    afterAll(async () => {
      await resetFixtures(prisma);
      await prisma.$disconnect();
    });

    test('health and discover return live database rows with no draft leakage', async () => {
      const health = await request(app).get('/health');
      expect(health.status).toBe(200);
      const r = await request(app).get('/api/v1/listings');
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(2);
      expect(r.body.items.some((x: any) => x.id === fx.draft.id)).toBe(false);
    });

    test('registration validates campus and returns an authenticated session', async () => {
      const bad = await request(app).post('/api/v1/auth/register').send({
        email: 'new@stage1.invalid', displayName: 'New Test', password: 'LongTestPassword!22', campusId: 999999,
      });
      expect(bad.status).toBe(400);
      expect(bad.body.error.code).toBe('invalid_campus');
      const good = await request(app).post('/api/v1/auth/register').set('X-Client', 'mobile').send({
        email: 'new@stage1.invalid', displayName: 'New Test', password: 'LongTestPassword!22', campusId: fx.campusA.id,
      });
      expect(good.status).toBe(201);
      expect(typeof good.body.accessToken).toBe('string');
      expect(typeof good.body.refreshToken).toBe('string');
      const me = await request(app).get('/api/v1/me').set({ Authorization: 'Bearer ' + good.body.accessToken });
      expect(me.status).toBe(200);
      expect(me.body.affiliations[0].status).toBe('pending');
    });

    test('invalid login, suspended account, and unauthenticated endpoint access are rejected', async () => {
      const wrong = await request(app).post('/api/v1/auth/login').send({ email: fx.buyer.email, password: 'wrong' });
      expect(wrong.status).toBe(401);
      const suspended = await request(app).post('/api/v1/auth/login').send({
        email: fx.suspended.email, password: 'TestPassphrase-Stage1-2026!',
      });
      expect(suspended.status).toBe(401);
      const mine = await request(app).get('/api/v1/seller/listings');
      expect(mine.status).toBe(401);
    });

    test('rotated refresh tokens cannot be reused and revoke the newly issued session', async () => {
      const login = await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile')
        .send({ email: fx.outsider.email, password: 'TestPassphrase-Stage1-2026!' });
      expect(login.status).toBe(200);
      const rotated = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: login.body.refreshToken });
      expect(rotated.status).toBe(200);
      const reused = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: login.body.refreshToken });
      expect(reused.status).toBe(401);
      const newToken = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: rotated.body.refreshToken });
      expect(newToken.status).toBe(401);
    });

    test('unverified student cannot create a seller profile; verified seller cannot create duplicates', async () => {
      const body = { storeName: 'Stage1 Store', description: 'A genuine seller account test' };
      const pending = await request(app).post('/api/v1/seller/store').set(token(fx.pending.id)).send(body);
      expect(pending.status).toBe(403);
      expect(pending.body.error.code).toBe('affiliation_not_verified');
      const duplicate = await request(app).post('/api/v1/seller/store').set(token(fx.seller.id)).send(body);
      expect(duplicate.status).toBe(409);
    });

    test('seller can create draft; other seller cannot edit it; bad price fails validation', async () => {
      const invalid = await request(app).post('/api/v1/seller/listings').set(token(fx.seller.id))
        .send({ ...sample(fx.category.id), price: -1 });
      expect(invalid.status).toBe(400);
      const created = await request(app).post('/api/v1/seller/listings').set(token(fx.seller.id))
        .send(sample(fx.category.id));
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('draft');
      const stranger = await request(app).patch('/api/v1/seller/listings/' + created.body.id)
        .set(token(fx.otherSeller.id)).send({ title: 'Stolen title' });
      expect(stranger.status).toBe(404);
      const actual = await prisma.listing.findUnique({ where: { id: created.body.id } });
      expect(actual?.title).toBe('Fresh Textbook Stage1');
    });

    test('published material edit returns to draft; unpublished details are private', async () => {
      const edited = await request(app).patch('/api/v1/seller/listings/' + fx.published.id)
        .set(token(fx.seller.id)).send({ title: 'Revised Stage1 Book' });
      expect(edited.status).toBe(200);
      expect(edited.body.status).toBe('draft');
      const anonymous = await request(app).get('/api/v1/listings/' + fx.published.id);
      expect(anonymous.status).toBe(404);
      const owner = await request(app).get('/api/v1/listings/' + fx.published.id).set(token(fx.seller.id));
      expect(owner.status).toBe(200);
      const anotherCampusReviewer = await request(app).get('/api/v1/listings/' + fx.published.id)
        .set(token(fx.reviewerB.id));
      expect(anotherCampusReviewer.status).toBe(404);
    });

    test('submission without image is rejected; prohibited category rejects submission', async () => {
      const noImage = await request(app).post('/api/v1/seller/listings/' + fx.draft.id + '/submit')
        .set(token(fx.seller.id)).send({});
      expect(noImage.status).toBe(422);
      expect(noImage.body.error.code).toBe('incomplete_listing');
      const restricted = await request(app).post('/api/v1/seller/listings').set(token(fx.seller.id))
        .send(sample(fx.prohibitedCategory.id));
      expect(restricted.status).toBe(201);
      const report = await request(app).post('/api/v1/seller/listings/' + restricted.body.id + '/submit')
        .set(token(fx.seller.id)).send({});
      expect(report.status).toBe(422);
      expect(report.body.error.code).toBe('category_prohibited');
    });

    test('search sort validation and pagination contract are enforced', async () => {
      const wrong = await request(app).get('/api/v1/listings?sort=unexpected');
      expect(wrong.status).toBe(400);
      for (const sort of ['newest', 'price_asc', 'price_desc']) {
        const r = await request(app).get('/api/v1/listings?sort=' + sort + '&pageSize=1');
        expect(r.status).toBe(200);
        expect(r.body.items.length).toBe(1);
        expect(r.body.pageSize).toBe(1);
      }
    });

    test('duplicate favorites are idempotent and private to the student', async () => {
      const first = await request(app).put('/api/v1/saved/' + fx.otherPublished.id).set(token(fx.buyer.id));
      const second = await request(app).put('/api/v1/saved/' + fx.otherPublished.id).set(token(fx.buyer.id));
      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
      const count = await prisma.savedListing.count({ where: { listingId: fx.otherPublished.id, userId: fx.buyer.id } });
      expect(count).toBe(1);
      const other = await request(app).get('/api/v1/saved').set(token(fx.outsider.id));
      expect(other.status).toBe(200);
      expect(other.body.some((l: any) => l.id === fx.otherPublished.id)).toBe(false);
    });

    test('own-listing inquiry and message to other student thread are rejected', async () => {
      const own = await request(app).post('/api/v1/inquiries').set(token(fx.otherSeller.id))
        .send({ listingId: fx.otherPublished.id, body: 'Own inquiry rejected' });
      expect(own.status).toBe(400);
      const started = await request(app).post('/api/v1/inquiries').set(token(fx.buyer.id))
        .send({ listingId: fx.otherPublished.id, body: 'Is this for sale?' });
      expect(started.status).toBe(201);
      const forbidden = await request(app).get('/api/v1/inquiries/' + started.body.id + '/messages')
        .set(token(fx.outsider.id));
      expect(forbidden.status).toBe(404);
      const tooLong = await request(app).post('/api/v1/inquiries/' + started.body.id + '/messages')
        .set(token(fx.buyer.id)).send({ body: 'x'.repeat(1001) });
      expect(tooLong.status).toBe(400);
      await prisma.inquiryThread.update({ where: { id: started.body.id }, data: { status: 'closed' } });
      const closed = await request(app).post('/api/v1/inquiries/' + started.body.id + '/messages')
        .set(token(fx.buyer.id)).send({ body: 'After close' });
      expect(closed.status).toBe(409);
    });

    test('student cannot access admin; reviewer campus isolation; global admin can review', async () => {
      const student = await request(app).get('/api/v1/admin/review-queue').set(token(fx.buyer.id));
      expect(student.status).toBe(403);
      const scoped = await request(app).post('/api/v1/admin/listings/' + fx.otherPublished.id + '/suspend')
        .set(token(fx.reviewerA.id)).send({ reason: 'Outside campus' });
      expect(scoped.status).toBe(404);
      const admin = await request(app).get('/api/v1/admin/review-queue').set(token(fx.globalAdmin.id));
      expect(admin.status).toBe(200);
    });

    test('administrative suspension records actor and target in audit log', async () => {
      const result = await request(app).post('/api/v1/admin/listings/' + fx.otherPublished.id + '/suspend')
        .set(token(fx.globalAdmin.id)).send({ reason: 'Stage1 simulated moderation' });
      expect(result.status).toBe(200);
      const row = await prisma.auditLog.findFirst({
        where: { action: 'listing.suspend', targetType: 'listing', targetId: fx.otherPublished.id },
      });
      expect(row?.actorUserId).toBe(fx.globalAdmin.id);
    });

    test('WP2: condition validation and product submission requirements', async () => {
      const item = await request(app).post('/api/v1/seller/listings').set(token(fx.seller.id))
        .send({ ...sample(fx.category.id), title: 'WP2 item condition' });
      expect(item.status).toBe(201);
      const invalidService = await request(app).post('/api/v1/seller/listings').set(token(fx.seller.id))
        .send({ ...sample(fx.category.id), type: 'service', condition: 'new' });
      expect(invalidService.status).toBe(400);
      await prisma.listingMedia.create({ data: { listingId: item.body.id,
        mimeType: 'image/jpeg', mediaPath: 'wp2-only.jpg', position: 0 } });
      const missing = await request(app).post('/api/v1/seller/listings/' + item.body.id + '/submit')
        .set(token(fx.seller.id)).send({});
      expect(missing.status).toBe(422);
      expect(missing.body.error.code).toBe('condition_required');
      const setCondition = await request(app).patch('/api/v1/seller/listings/' + item.body.id)
        .set(token(fx.seller.id)).send({ condition: 'good' });
      expect(setCondition.status).toBe(200);
      const submitted = await request(app).post('/api/v1/seller/listings/' + item.body.id + '/submit')
        .set(token(fx.seller.id)).send({});
      expect(submitted.status).toBe(200);
      expect(submitted.body.status).toBe('pending_review');
    });

    test('WP2: reserved and sold are excluded from public search and cannot be relisted', async () => {
      const item = await prisma.listing.create({ data: {
        type: 'physical_product', sellerProfileId: fx.store.id, campusId: fx.campusA.id,
        categoryId: fx.category.id, title: 'WP2 Availability Item',
        description: 'A product used for availability tests', price: 300, condition: 'like_new',
        status: 'published',
      } });
      const filter = await request(app).get('/api/v1/listings?condition=like_new');
      expect(filter.status).toBe(200);
      expect(filter.body.items.some((l: any) => l.id === item.id)).toBe(true);
      const invalid = await request(app).patch('/api/v1/seller/listings/' + item.id + '/availability')
        .set(token(fx.buyer.id)).send({ availability: 'sold' });
      expect(invalid.status).toBe(404);
      const reserved = await request(app).patch('/api/v1/seller/listings/' + item.id + '/availability')
        .set(token(fx.seller.id)).send({ availability: 'reserved' });
      expect(reserved.status).toBe(200);
      const hidden = await request(app).get('/api/v1/listings?condition=like_new');
      expect(hidden.body.items.some((l: any) => l.id === item.id)).toBe(false);
      const blockedInquiry = await request(app).post('/api/v1/inquiries').set(token(fx.buyer.id))
        .send({ listingId: item.id, body: 'Can I buy it?' });
      expect(blockedInquiry.status).toBe(409);
      const available = await request(app).patch('/api/v1/seller/listings/' + item.id + '/availability')
        .set(token(fx.seller.id)).send({ availability: 'available' });
      expect(available.status).toBe(200);
      const selfSave = await request(app).put('/api/v1/saved/' + item.id).set(token(fx.seller.id));
      expect(selfSave.status).toBe(400);
      const saved = await request(app).put('/api/v1/saved/' + item.id).set(token(fx.buyer.id));
      expect(saved.status).toBe(204);
      const sold = await request(app).patch('/api/v1/seller/listings/' + item.id + '/availability')
        .set(token(fx.seller.id)).send({ availability: 'sold' });
      expect(sold.status).toBe(200);
      expect((await prisma.listing.findUnique({ where: { id: item.id } }))?.availabilityState).toBe('sold');
      const relist = await request(app).patch('/api/v1/seller/listings/' + item.id + '/availability')
        .set(token(fx.seller.id)).send({ availability: 'available' });
      expect(relist.status).toBe(409);
      const savedAgain = await request(app).put('/api/v1/saved/' + item.id).set(token(fx.outsider.id));
      expect(savedAgain.status).toBe(409);
      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'listing.availability_changed', targetId: item.id } });
      expect(auditRow).not.toBeNull();
    });

    test('WP2: soft deletion hides the listing but retains existing inquiry history', async () => {
      const item = await prisma.listing.create({ data: {
        type: 'physical_product', sellerProfileId: fx.store.id, campusId: fx.campusA.id,
        categoryId: fx.category.id, title: 'WP2 Soft Delete',
        description: 'Retain the conversation and reporting records', price: 155,
        condition: 'fair', status: 'published',
      } });
      const thread = await request(app).post('/api/v1/inquiries').set(token(fx.buyer.id))
        .send({ listingId: item.id, body: 'Is it available before removal?' });
      expect(thread.status).toBe(201);
      const blocked = await request(app).delete('/api/v1/seller/listings/' + item.id)
        .set(token(fx.otherSeller.id));
      expect(blocked.status).toBe(404);
      const deleted = await request(app).delete('/api/v1/seller/listings/' + item.id)
        .set(token(fx.seller.id));
      expect(deleted.status).toBe(204);
      const publicDetail = await request(app).get('/api/v1/listings/' + item.id);
      expect(publicDetail.status).toBe(404);
      expect((await prisma.listing.findUnique({ where: { id: item.id } }))?.deletedAt).not.toBeNull();
      expect(await prisma.inquiryThread.count({ where: { id: thread.body.id } })).toBe(1);
      const messages = await request(app).get('/api/v1/inquiries/' + thread.body.id + '/messages')
        .set(token(fx.buyer.id));
      expect(messages.status).toBe(200);
      const auditRow = await prisma.auditLog.findFirst({
        where: { action: 'listing.soft_deleted', targetId: item.id } });
      expect(auditRow).not.toBeNull();
    });

    test('database uniqueness constraints reject duplicate affiliations and duplicate favorites', async () => {
      const affiliation = await prisma.affiliation.findFirstOrThrow({ where: { userId: fx.buyer.id } });
      const rejectedAffiliation = await prisma.affiliation.create({ data: {
        userId: affiliation.userId, campusId: affiliation.campusId, verificationStatus: 'pending',
      } }).then(() => false, () => true);
      expect(rejectedAffiliation).toBe(true);
      const saved = await prisma.savedListing.findFirstOrThrow({ where: { userId: fx.buyer.id } });
      const rejectedFavorite = await prisma.savedListing.create({
        data: { userId: saved.userId, listingId: saved.listingId },
      }).then(() => false, () => true);
      expect(rejectedFavorite).toBe(true);
    });
  });
} else {
  describe.skip('Stage 1 integration (run with bun run test:integration)', () => {
    test('opt-in integration suite', () => {});
  });
}
