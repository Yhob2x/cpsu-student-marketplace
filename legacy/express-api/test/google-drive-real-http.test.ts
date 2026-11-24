import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';

const name = process.env.CPSU_DRIVE_REAL_HTTP_TEST ?? '';
const db = new URL(process.env.DATABASE_URL || 'mysql://invalid@127.0.0.1/invalid');
if (!/^cpsu_drive_smoke_[a-f0-9]{10}$/.test(name) ||
    db.pathname !== '/' + name || process.env.NODE_ENV !== 'test' ||
    process.env.MEDIA_STORAGE !== 'google_drive') {
  // Opt-in test: ordinary bun test must never connect to Google or modify a DB.
  test.skip('real Drive HTTP acceptance requires guarded isolated runner', () => {});
} else {

const { createApp } = await import('../src/app.js');
const { prisma } = await import('../src/db.js');
const { signAccess } = await import('../src/auth.js');
const { googleDriveFromEnv, driveMediaId } = await import('../src/media-storage.js');
const app = createApp();
const drive = googleDriveFromEnv();
const token = (userId: number) => ({ Authorization: 'Bearer ' + signAccess(userId) });

function asBuffer(req: request.Test) {
  return req.buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
    res.on('error', cb);
  });
}

test('real Google Drive: seller upload, private API access, reviewer approval, published image', async () => {
  let fileId: string | null = null;
  try {
    const campus = await prisma.campus.create({
      data: { code: 'GDTEST', name: 'Google Drive Synthetic Test Campus' },
    });
    const category = await prisma.category.create({
      data: { name: 'Google Drive Test Item', listingType: 'physical_product' },
    });
    const seller = await prisma.user.create({
      data: { email: 'drive-seller@smoke.invalid', displayName: 'Drive Test Seller', passwordHash: 'synthetic-smoke-not-a-login' },
    });
    const outsider = await prisma.user.create({
      data: { email: 'drive-outsider@smoke.invalid', displayName: 'Drive Test Outsider', passwordHash: 'synthetic-smoke-not-a-login' },
    });
    const reviewer = await prisma.user.create({
      data: { email: 'drive-reviewer@smoke.invalid', displayName: 'Drive Test Reviewer', passwordHash: 'synthetic-smoke-not-a-login',
        roles: { create: { role: 'campus_reviewer', campusId: campus.id } } },
    });
    const store = await prisma.sellerProfile.create({
      data: { ownerUserId: seller.id, campusId: campus.id, storeName: 'Drive Synthetic Store',
        description: 'Test only and never published outside temporary database', approvalStatus: 'approved' },
    });
    await prisma.affiliation.create({ data: { userId: seller.id, campusId: campus.id, verificationStatus: 'verified' } });
    const listing = await prisma.listing.create({
      data: { sellerProfileId: store.id, campusId: campus.id, categoryId: category.id,
        type: 'physical_product', title: 'Synthetic Green Image', description: 'Synthetic image for private storage acceptance',
        price: 150, status: 'draft', condition: 'good' },
    });
    const image = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#315f45' } })
      .png().toBuffer();
    const endpoint = '/api/v1/seller/listings/' + listing.id + '/media';
    const outsiderAttempt = await request(app).post(endpoint).set(token(outsider.id))
      .attach('image', image, { filename: 'synthetic.png', contentType: 'image/png' });
    expect(outsiderAttempt.status).toBe(404);
    const uploaded = await request(app).post(endpoint).set(token(seller.id))
      .attach('image', image, { filename: 'synthetic.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    const record = await prisma.listingMedia.findUniqueOrThrow({ where: { id: uploaded.body.id } });
    fileId = driveMediaId(record.mediaPath);
    expect(fileId).toBeTruthy();
    expect(record.mimeType).toBe('image/webp');
    const mediaUrl = '/api/v1/media/' + record.id;
    expect((await request(app).get(mediaUrl)).status).toBe(404);
    expect((await request(app).get(mediaUrl).set(token(outsider.id))).status).toBe(404);
    const owner = await asBuffer(request(app).get(mediaUrl).set(token(seller.id)));
    expect(owner.status).toBe(200);
    const reviewerView = await asBuffer(request(app).get(mediaUrl).set(token(reviewer.id)));
    expect(reviewerView.status).toBe(200);
    const normalized = await sharp(owner.body as Buffer).metadata();
    expect(normalized.format).toBe('webp');
    expect(normalized.exif).toBeUndefined();
    expect(createHash('sha256').update(owner.body as Buffer).digest('hex')).toBe(
      createHash('sha256').update(reviewerView.body as Buffer).digest('hex'),
    );
    const submission = await request(app).post('/api/v1/seller/listings/' + listing.id + '/submit').set(token(seller.id)).send({});
    expect(submission.status).toBe(200);
    const reviewUrl = '/api/v1/admin/listings/' + listing.id + '/decision';
    const unreviewed = await request(app).post(reviewUrl).set(token(reviewer.id))
      .send({ decision: 'approved', reason: 'Synthetic media check' });
    expect(unreviewed.status).toBe(422);
    const approved = await request(app).post(reviewUrl).set(token(reviewer.id))
      .send({ decision: 'approved', reason: 'Synthetic image was reviewed', photosReviewed: true });
    expect(approved.status).toBe(200);
    const publicView = await asBuffer(request(app).get(mediaUrl));
    expect(publicView.status).toBe(200);
    expect(createHash('sha256').update(publicView.body as Buffer).digest('hex')).toBe(
      createHash('sha256').update(owner.body as Buffer).digest('hex'),
    );
    console.log('Real Google Drive HTTP flow PASS: upload, private owner/reviewer, anonymous denied, approved public view');
  } finally {
    if (fileId) {
      await drive.delete(fileId);
      console.log('Real Google Drive HTTP test-file cleanup PASS');
    }
    await prisma.$disconnect();
  }
}, 45_000);
}
