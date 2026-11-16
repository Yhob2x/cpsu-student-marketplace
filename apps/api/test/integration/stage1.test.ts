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

    test('upload sanitization and human photo-review gate prevent unreviewed media publication', async () => {
      const { default: sharp } = await import('sharp');
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { env } = await import('../../src/env.js');
      const safePixels = await sharp({
        create: { width: 48, height: 32, channels: 3, background: '#78a88a' },
      }).png().toBuffer();
      const created = await request(app).post('/api/v1/seller/listings')
        .set(token(fx.seller.id)).send({ ...sample(fx.category.id), condition: 'good' });
      expect(created.status).toBe(201);
      const listingId = created.body.id;
      const target = '/api/v1/seller/listings/' + listingId + '/media';

      // Permission checking happens before multipart disk storage.
      const outsider = await request(app).post(target).set(token(fx.outsider.id))
        .attach('image', safePixels, { filename: 'synthetic.png', contentType: 'image/png' });
      expect(outsider.status).toBe(404);

      // A declared JPEG cannot contain PNG bytes, and text renamed to JPEG is not an image.
      const spoofedMime = await request(app).post(target).set(token(fx.seller.id))
        .attach('image', safePixels, { filename: 'disguised.jpg', contentType: 'image/jpeg' });
      expect(spoofedMime.status).toBe(400);
      expect(spoofedMime.body.error.code).toBe('invalid_image');
      const randomBytes = await request(app).post(target).set(token(fx.seller.id))
        .attach('image', Buffer.from('this is not a real image'), { filename: 'invalid.jpg', contentType: 'image/jpeg' });
      expect(randomBytes.status).toBe(400);
      expect(randomBytes.body.error.code).toBe('invalid_image');
      expect(await prisma.listingMedia.count({ where: { listingId } })).toBe(0);
      expect((await fs.readdir(env.UPLOAD_DIR)).filter(f => f.endsWith('.upload'))).toHaveLength(0);

      // The only stored image is a decoded/re-encoded WebP with no EXIF metadata.
      const accepted = await request(app).post(target).set(token(fx.seller.id))
        .attach('image', safePixels, { filename: 'synthetic.png', contentType: 'image/png' });
      expect(accepted.status).toBe(201);
      const stored = await prisma.listingMedia.findUniqueOrThrow({ where: { id: accepted.body.id } });
      expect(stored.mimeType).toBe('image/webp');
      expect(stored.mediaPath.endsWith('.webp')).toBe(true);
      const normalized = await sharp(await fs.readFile(path.join(env.UPLOAD_DIR, stored.mediaPath))).metadata();
      expect(normalized.format).toBe('webp');
      expect(normalized.exif).toBeUndefined();

      const submitted = await request(app).post('/api/v1/seller/listings/' + listingId + '/submit')
        .set(token(fx.seller.id)).send({});
      expect(submitted.status).toBe(200);
      const decision = '/api/v1/admin/listings/' + listingId + '/decision';
      const unchecked = await request(app).post(decision).set(token(fx.reviewerA.id))
        .send({ decision: 'approved', reason: 'Photos checked' });
      expect(unchecked.status).toBe(422);
      expect(unchecked.body.error.code).toBe('photo_review_required');
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe('pending_review');
      const otherCampus = await request(app).post(decision).set(token(fx.reviewerB.id))
        .send({ decision: 'approved', reason: 'Photos checked', photosReviewed: true });
      expect(otherCampus.status).toBe(404);
      const approved = await request(app).post(decision).set(token(fx.reviewerA.id))
        .send({ decision: 'approved', reason: 'Photos checked', photosReviewed: true });
      expect(approved.status).toBe(200);
      expect(approved.body.status).toBe('published');

      // New photos added to approved listings MUST be reviewed again.
      const second = await request(app).post(target).set(token(fx.seller.id))
        .attach('image', safePixels, { filename: 'another.png', contentType: 'image/png' });
      expect(second.status).toBe(201);
      expect((await prisma.listing.findUniqueOrThrow({ where: { id: listingId } })).status).toBe('draft');
      const publicView = await request(app).get('/api/v1/media/' + second.body.id);
      expect(publicView.status).toBe(404);
      expect((await fs.readdir(env.UPLOAD_DIR)).filter(f => f.endsWith('.upload'))).toHaveLength(0);
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

    test('message receipts require real recipient retrieval and visible read acknowledgment', async () => {
      // Own fixture: earlier tests deliberately move the shared published listing to draft.
      const listing = await prisma.listing.create({ data: {
        type: 'physical_product', sellerProfileId: fx.store.id, campusId: fx.campusA.id,
        categoryId: fx.category.id, title: 'Message receipt test listing',
        description: 'Test-only listing for delivery and read acknowledgments',
        price: 125, status: 'published',
      } });
      // Two media records verify that the thread summary selects the first ordered photo.
      const secondPhoto = await prisma.listingMedia.create({ data: {
        listingId: listing.id, mediaPath: 'test-second.jpg', mimeType: 'image/jpeg', position: 2,
      } });
      const firstPhoto = await prisma.listingMedia.create({ data: {
        listingId: listing.id, mediaPath: 'test-first.jpg', mimeType: 'image/jpeg', position: 1,
      } });
      const started = await request(app).post('/api/v1/inquiries').set(token(fx.buyer.id))
        .send({ listingId: listing.id, body: 'Receipt lifecycle initial message' });
      expect(started.status).toBe(201);
      const threadId = started.body.id;
      const first = await prisma.inquiryMessage.findFirstOrThrow({ where: { threadId } });
      const path = '/api/v1/inquiries/' + threadId;

      const senderView = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(senderView.status).toBe(200);
      expect(senderView.body.thread.otherStudentName).toBe(fx.seller.displayName);
      expect(senderView.body.listing).toMatchObject({
        id: listing.id, title: listing.title, type: 'physical_product',
        price: 125, priceBasis: 'per item', condition: null,
        availability: 'available', imageUrl: `/api/v1/media/${firstPhoto.id}`,
      });
      expect(senderView.body.listing.imageUrl).not.toBe(`/api/v1/media/${secondPhoto.id}`);
      const buyerInbox = await request(app).get('/api/v1/inquiries').set(token(fx.buyer.id));
      const sellerInbox = await request(app).get('/api/v1/inquiries').set(token(fx.seller.id));
      expect(buyerInbox.body.find((row: any) => row.id === threadId)?.otherStudentName).toBe(fx.seller.displayName);
      expect(sellerInbox.body.find((row: any) => row.id === threadId)?.otherStudentName).toBe(fx.buyer.displayName);
      // Show only the other participant's display name, not their email or credentials.
      expect(JSON.stringify(buyerInbox.body)).not.toContain(fx.seller.email);
      expect(JSON.stringify(sellerInbox.body)).not.toContain(fx.buyer.email);
      expect(senderView.body.messages[0].receipt).toBe('sent');
      expect(senderView.body.otherActiveInChat).toBe(false);
      expect((await prisma.inquiryMessage.findUniqueOrThrow({ where: { id: first.id } })).deliveredAt).toBeNull();

      // Presence reports only a participant's recent heartbeat in this conversation.
      const outsiderPresence = await request(app).post(path + '/presence').set(token(fx.outsider.id)).send({});
      expect(outsiderPresence.status).toBe(404);
      const onlineHeartbeat = await request(app).post(path + '/presence').set(token(fx.seller.id)).send({});
      expect(onlineHeartbeat.status).toBe(204);
      const senderWithPresence = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(senderWithPresence.body.otherActiveInChat).toBe(true);
      // Presence alone does not claim that a message was delivered or seen.
      expect(senderWithPresence.body.messages[0].receipt).toBe('sent');

      // Reading your own thread as the author does not mark your own message as seen.
      const selfSeen = await request(app).post(path + '/seen').set(token(fx.buyer.id))
        .send({ upToId: first.id });
      expect(selfSeen.status).toBe(204);
      expect((await prisma.inquiryMessage.findUniqueOrThrow({ where: { id: first.id } })).seenAt).toBeNull();

      const outsider = await request(app).post(path + '/seen').set(token(fx.outsider.id))
        .send({ upToId: first.id });
      expect(outsider.status).toBe(404);
      const invalid = await request(app).post(path + '/seen').set(token(fx.seller.id))
        .send({ upToId: 'not-a-message-id' });
      expect(invalid.status).toBe(400);

      const received = await request(app).get(path + '/messages').set(token(fx.seller.id));
      expect(received.status).toBe(200);
      expect(received.body.thread.otherStudentName).toBe(fx.buyer.displayName);
      expect(received.body.listing).toEqual(senderView.body.listing);
      expect(received.body.messages[0].receipt).toBe('delivered');
      expect(received.body.messages[0].seenAt).toBeNull();
      const senderDelivered = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(senderDelivered.body.messages[0].receipt).toBe('delivered');

      const seen = await request(app).post(path + '/seen').set(token(fx.seller.id))
        .send({ upToId: first.id });
      expect(seen.status).toBe(204);
      const senderRead = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(senderRead.body.messages[0].receipt).toBe('read');

      // Up-to receipts cannot mark a newer message as read before it was viewed.
      const reply = await request(app).post(path + '/messages').set(token(fx.buyer.id))
        .send({ body: 'Second message has not yet been read' });
      expect(reply.status).toBe(201);
      const secondId = reply.body.id;
      await request(app).get(path + '/messages').set(token(fx.seller.id));
      await request(app).post(path + '/seen').set(token(fx.seller.id)).send({ upToId: first.id });
      const second = await prisma.inquiryMessage.findUniqueOrThrow({ where: { id: secondId } });
      expect(second.deliveredAt).not.toBeNull();
      expect(second.seenAt).toBeNull();

      const inbox = await request(app).get('/api/v1/inquiries').set(token(fx.buyer.id));
      const preview = inbox.body.find((row: any) => row.id === threadId);
      expect(preview?.lastMessage?.mine).toBe(true);
      expect(preview?.lastMessage?.receipt).toBe('delivered');
      await request(app).post(path + '/seen').set(token(fx.seller.id)).send({ upToId: secondId });
      const final = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(final.body.messages.at(-1).receipt).toBe('read');

      // Existing participants retain listing context after unpublishing, but private
      // media is not exposed through a chat response.
      await prisma.listing.update({ where: { id: listing.id }, data: { status: 'draft' } });
      const unpublished = await request(app).get(path + '/messages').set(token(fx.buyer.id));
      expect(unpublished.status).toBe(200);
      expect(unpublished.body.listing.title).toBe(listing.title);
      expect(unpublished.body.listing.availability).toBe('unavailable');
      expect(unpublished.body.listing.imageUrl).toBeNull();
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

    test('campus reviewers can only read and resolve reports about their permitted campus', async () => {
      const a = await prisma.report.create({ data: {
        reporterUserId: fx.buyer.id, listingId: fx.published.id, reason: 'Test report on campus A',
      } });
      const b = await prisma.report.create({ data: {
        reporterUserId: fx.buyer.id, sellerProfileId: fx.storeB.id, reason: 'Test report on campus B',
      } });
      const aQueue = await request(app).get('/api/v1/admin/reports').set(token(fx.reviewerA.id));
      expect(aQueue.status).toBe(200);
      expect(aQueue.body.some((rep: any) => rep.id === a.id)).toBe(true);
      expect(aQueue.body.some((rep: any) => rep.id === b.id)).toBe(false);
      const bQueue = await request(app).get('/api/v1/admin/reports').set(token(fx.reviewerB.id));
      expect(bQueue.body.some((rep: any) => rep.id === b.id)).toBe(true);
      expect(bQueue.body.some((rep: any) => rep.id === a.id)).toBe(false);
      const rejected = await request(app).post('/api/v1/admin/reports/' + b.id + '/resolve')
        .set(token(fx.reviewerA.id)).send({ status: 'resolved' });
      expect(rejected.status).toBe(404);
      expect((await prisma.report.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('open');
      expect(await prisma.auditLog.count({ where: { action: 'report.resolved', targetId: b.id } })).toBe(0);
      const global = await request(app).get('/api/v1/admin/reports').set(token(fx.globalAdmin.id));
      expect(global.body.some((rep: any) => rep.id === b.id)).toBe(true);
      const allowed = await request(app).post('/api/v1/admin/reports/' + b.id + '/resolve')
        .set(token(fx.reviewerB.id)).send({ status: 'resolved' });
      expect(allowed.status).toBe(204);
      const replay = await request(app).post('/api/v1/admin/reports/' + b.id + '/resolve')
        .set(token(fx.reviewerB.id)).send({ status: 'dismissed' });
      expect(replay.status).toBe(409);
    });

    test('a suspended seller cannot appear in public discovery, profile, details, or media', async () => {
      const owner = await prisma.user.create({ data: {
        email: 'visibility-owner@stage1.invalid', displayName: 'Visibility Owner',
        passwordHash: await hashPassword('TestPassphrase-Stage1-2026!'), status: 'active',
      } });
      const store = await prisma.sellerProfile.create({ data: {
        ownerUserId: owner.id, campusId: fx.campusA.id, storeName: 'Hidden Shop',
        description: 'Should disappear when account is suspended', approvalStatus: 'approved',
      } });
      const item = await prisma.listing.create({ data: {
        sellerProfileId: store.id, campusId: fx.campusA.id, categoryId: fx.category.id,
        type: 'physical_product', title: 'Visibility Sample', description: 'Test visibility item',
        price: 95, status: 'published',
      } });
      const media = await prisma.listingMedia.create({ data: {
        listingId: item.id, mediaPath: 'synthetic-visibility.webp', mimeType: 'image/webp',
      } });
      await prisma.savedListing.create({ data: { listingId: item.id, userId: fx.buyer.id } });
      expect((await request(app).get('/api/v1/listings')).body.items.some((l: any) => l.id === item.id)).toBe(true);
      const thread = await request(app).post('/api/v1/inquiries').set(token(fx.buyer.id))
        .send({ listingId: item.id, body: 'Before owner suspension' });
      expect(thread.status).toBe(201);
      await prisma.user.update({ where: { id: owner.id }, data: { status: 'suspended' } });
      const search = await request(app).get('/api/v1/listings');
      expect(search.body.items.some((l: any) => l.id === item.id)).toBe(false);
      expect((await request(app).get('/api/v1/listings/popular')).body.items.some((l: any) => l.id === item.id)).toBe(false);
      expect((await request(app).get('/api/v1/listings/' + item.id)).status).toBe(404);
      expect((await request(app).get('/api/v1/seller-profiles/' + store.id)).status).toBe(404);
      expect((await request(app).get('/api/v1/media/' + media.id)).status).toBe(404);
      expect((await request(app).post('/api/v1/inquiries').set(token(fx.outsider.id))
        .send({ listingId: item.id, body: 'Do not contact suspended owner' })).status).toBe(404);
      expect((await request(app).post('/api/v1/inquiries/' + thread.body.id + '/messages')
        .set(token(fx.buyer.id)).send({ body: 'Do not send to suspended owner' })).status).toBe(409);
      const history = await request(app).get('/api/v1/inquiries/' + thread.body.id + '/messages').set(token(fx.buyer.id));
      expect(history.status).toBe(200);
      expect(history.body.listing.imageUrl).toBeNull();
      expect((await request(app).get('/api/v1/saved').set(token(fx.buyer.id))).body.some((l: any) => l.id === item.id)).toBe(false);
    });

    test('only university administration can page through audited security decisions', async () => {
      const id = fx.published.id;
      await prisma.auditLog.create({ data: {
        actorUserId: fx.globalAdmin.id, action: 'test.security.review', targetType: 'listing',
        targetId: id, metadata: { result: 'synthetic' },
      } });
      const url = '/api/v1/admin/audit-logs?limit=1';
      expect((await request(app).get(url).set(token(fx.buyer.id))).status).toBe(403);
      expect((await request(app).get(url).set(token(fx.reviewerA.id))).status).toBe(403);
      const first = await request(app).get(url).set(token(fx.globalAdmin.id));
      expect(first.status).toBe(200);
      expect(first.body.items).toHaveLength(1);
      expect(first.body.items[0]).toMatchObject({
        action: 'test.security.review', targetType: 'listing', targetId: id,
      });
      expect(first.body.items[0]).not.toHaveProperty('passwordHash');
      expect(first.body.nextCursor).toBe(first.body.items[0].id);
      const second = await request(app).get(url + '&cursor=' + first.body.nextCursor)
        .set(token(fx.globalAdmin.id));
      expect(second.status).toBe(200);
      expect(second.body.items.some((a: any) => a.id === first.body.items[0].id)).toBe(false);
    });

    test('refresh denies an account suspended outside the normal admin workflow', async () => {
      const login = await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile')
        .send({ email: fx.outsider.email, password: 'TestPassphrase-Stage1-2026!' });
      expect(login.status).toBe(200);
      await prisma.user.update({ where: { id: fx.outsider.id }, data: { status: 'suspended' } });
      const refresh = await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: login.body.refreshToken });
      await prisma.user.update({ where: { id: fx.outsider.id }, data: { status: 'active' } });
      expect(refresh.status).toBe(401);
    });

    test('only a university admin can suspend and reactivate a student with audit and session revocation', async () => {
      const pass = 'TestPassphrase-Stage1-2026!';
      const student = await prisma.user.create({ data: {
        email: 'managed-student@stage1.invalid', displayName: 'Managed Student',
        passwordHash: await hashPassword(pass),
        affiliations: { create: { campusId: fx.campusA.id, verificationStatus: 'verified' } },
      } });
      const login = await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile')
        .send({ email: student.email, password: pass });
      expect(login.status).toBe(200);
      const route = '/api/v1/admin/users/' + student.id + '/status';
      const reason = 'Confirmed test-only policy violation';
      expect((await request(app).patch(route).set(token(fx.buyer.id))
        .send({ status: 'suspended', reason })).status).toBe(403);
      expect((await request(app).patch(route).set(token(fx.reviewerA.id))
        .send({ status: 'suspended', reason })).status).toBe(403);
      expect((await request(app).patch('/api/v1/admin/users/' + fx.globalAdmin.id + '/status')
        .set(token(fx.globalAdmin.id)).send({ status: 'suspended', reason })).status).toBe(409);
      const search = await request(app).get('/api/v1/admin/users?q=managed-student').set(token(fx.globalAdmin.id));
      expect(search.status).toBe(200);
      expect(search.body.items.some((item: any) => item.id === student.id)).toBe(true);
      expect(JSON.stringify(search.body)).not.toContain('passwordHash');

      const suspended = await request(app).patch(route).set(token(fx.globalAdmin.id))
        .send({ status: 'suspended', reason });
      expect(suspended.status).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: student.id } })).status).toBe('suspended');
      expect((await request(app).get('/api/v1/me')
        .set({ Authorization: 'Bearer ' + login.body.accessToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: login.body.refreshToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile')
        .send({ email: student.email, password: pass })).status).toBe(401);
      expect(await prisma.session.count({ where: { userId: student.id, revokedAt: null } })).toBe(0);
      expect((await prisma.auditLog.findFirst({ where: {
        actorUserId: fx.globalAdmin.id, action: 'user.suspended', targetId: student.id,
      } }))?.metadata).toMatchObject({ reason });
      expect((await request(app).patch(route).set(token(fx.globalAdmin.id))
        .send({ status: 'suspended', reason })).status).toBe(409);

      const activated = await request(app).patch(route).set(token(fx.globalAdmin.id))
        .send({ status: 'active', reason: 'Appeal reviewed and restriction lifted' });
      expect(activated.status).toBe(200);
      expect((await request(app).post('/api/v1/auth/refresh').set('X-Client', 'mobile')
        .send({ refreshToken: login.body.refreshToken })).status).toBe(401);
      expect((await request(app).post('/api/v1/auth/login').set('X-Client', 'mobile')
        .send({ email: student.email, password: pass })).status).toBe(200);
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
