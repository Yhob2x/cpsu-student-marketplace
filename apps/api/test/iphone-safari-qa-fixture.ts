/**
 * Owner-approved personal iPhone Safari QA fixtures. Exactly TWO synthetic users
 * and ONE published test listing. NEVER use in ordinary tests, production or dev DB.
 *
 * From apps/api (Bun auto-loads local .env for source identity only):
 *   $env:NODE_ENV='test'; $env:CPSU_IPHONE_QA_FIXTURES='approved'
 *   bun test/iphone-safari-qa-fixture.ts prepare | verify | cleanup
 *
 * Passwords are never printed. Private file lives OUTSIDE the repository,
 * under the previously audited restricted iPhone LAN HTTPS directory.
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';

const mode = process.argv[2];
if (!['inspect','prepare','verify','cleanup'].includes(mode)) throw new Error('Expected inspect, prepare, verify or cleanup');
const source = new URL(process.env.DATABASE_URL ?? '');
if (process.env.CPSU_IPHONE_QA_FIXTURES !== 'approved' ||
    process.env.NODE_ENV !== 'test' || source.protocol !== 'mysql:' ||
    source.hostname !== '127.0.0.1' || source.port !== '3306' ||
    source.pathname !== '/cpsu_marketplace' || source.search || source.hash) {
  throw new Error('REFUSED: explicit approval, NODE_ENV=test and local CPSU source identity required.');
}
const base = process.env.LOCALAPPDATA;
if (!base || process.platform !== 'win32') throw new Error('REFUSED: expected local Windows user context');
const secretDir = join(base, 'CPSU-Marketplace', 'iphone-lan-https');
if (!existsSync(secretDir)) throw new Error('REFUSED: restricted QA private directory missing');
const secretPath = join(secretDir, 'CPSU-iPhone-Safari-QA-credentials.json');
const testUrl = new URL(source.href);
testUrl.pathname = '/cpsu_marketplace_push_test';
const prisma = new PrismaClient({ datasources: { db: { url: testUrl.href } } });
const testMarker = 'CPSU-IPHONE-QA-20261117';
const buyerEmail = 'cpsu-iphone-buyer-20261117@example.invalid';
const sellerEmail = 'cpsu-iphone-seller-20261117@example.invalid';
const listingTitle = 'CPSU iPhone QA — Synthetic Textbook (Not For Sale)';

type Secret = {
  marker: string;
  buyer: { email: string; password: string; id?: number };
  seller: { email: string; password: string; id?: number };
  listingId?: number;
  sellerProfileId?: number;
  campusId?: number;
  categoryId?: number;
};
const readSecret = (): Secret => {
  if (!existsSync(secretPath)) throw new Error('Private fixture record absent; no action taken.');
  const raw = JSON.parse(readFileSync(secretPath, 'utf8')) as Secret;
  if (raw.marker !== testMarker || raw.buyer?.email !== buyerEmail || raw.seller?.email !== sellerEmail ||
      !raw.buyer?.id || !raw.seller?.id || !raw.listingId || !raw.sellerProfileId ||
      !raw.campusId || !raw.categoryId) {
    throw new Error('REFUSED: private fixture record mismatch or incomplete. Do not remove any rows.');
  }
  return raw;
};
async function identity() {
  const result = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT DATABASE() AS db');
  if (result[0]?.db !== 'cpsu_marketplace_push_test') {
    throw new Error('REFUSED: SQL connection is not the isolated iPhone test schema.');
  }
}
// Detect unapproved pending schema changes before passwords or fixture writes.
async function assertCompatibleTestSchema() {
  const columns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SellerProfile' AND COLUMN_NAME IN ('avatarPath')"
  );
  const present = new Set(columns.map(c => c.COLUMN_NAME));
  const missing = ['avatarPath'].filter(c => !present.has(c));
  if (missing.length) {
    throw new Error('REFUSED: isolated iPhone QA schema missing SellerProfile columns ' +
      missing.join(', ') + '; requires a separately approved test-only migration and source/migration reconciliation. No fixtures written.');
  }
}
async function fixtureCounts() {
  return {
    users: await prisma.user.count(),
    campuses: await prisma.campus.count(),
    categories: await prisma.category.count(),
    sellers: await prisma.sellerProfile.count(),
    listings: await prisma.listing.count(),
    threads: await prisma.inquiryThread.count(),
    transactions: await prisma.transaction.count(),
  };
}
async function assertFixtureMatches(s: Secret) {
  const [buyer, seller, listing] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.buyer.id! } }),
    prisma.user.findUnique({ where: { id: s.seller.id! } }),
    prisma.listing.findUnique({ where: { id: s.listingId! } }),
  ]);
  if (buyer?.email !== buyerEmail || seller?.email !== sellerEmail ||
      listing?.title !== listingTitle || listing.sellerProfileId !== s.sellerProfileId ||
      listing.campusId !== s.campusId || listing.categoryId !== s.categoryId) {
    throw new Error('REFUSED: existing synthetic fixture rows do not match private record.');
  }
}
try {
  await identity();
  if (mode === 'inspect') {
    const counts = await fixtureCounts();
    const campuses = await prisma.campus.findMany({ select: { id: true, code: true, name: true, active: true } });
    console.log('ISOLATED QA COUNTS ' + JSON.stringify(counts));
    console.log('EXISTING QA CAMPUSES ' + JSON.stringify(campuses));
  } else if (mode === 'prepare') {
    await assertCompatibleTestSchema();
    if (existsSync(secretPath)) throw new Error('REFUSED: credentials already exist; use verify instead of overwriting.');
    const before = await fixtureCounts();
    // Preserve the existing active CPSU campus, already present in the isolated QA DB.
    // No existing campus, user, or listing is deleted or overwritten.
    const existingCampus = await prisma.campus.findMany({
      select: { id: true, code: true, active: true },
    });
    if (before.users !== 0 || before.campuses !== 1 || before.categories !== 0 ||
        before.sellers !== 0 || before.listings !== 0 || before.threads !== 0 ||
        before.transactions !== 0 || existingCampus.length !== 1 ||
        existingCampus[0].code !== 'CAUAYAN' || !existingCampus[0].active) {
      throw new Error('REFUSED: isolated QA fixture baseline unexpected; will not alter existing rows. Counts: ' + JSON.stringify(before));
    }
    const secrets: Secret = {
      marker: testMarker,
      buyer: { email: buyerEmail, password: randomBytes(32).toString('base64url') },
      seller: { email: sellerEmail, password: randomBytes(32).toString('base64url') },
    };
    // The directory itself has owner / SYSTEM / Administrators ACLs, audited by
    // the iPhone certificate preflight. Write secrets only in that directory.
    // Atomic exclusive creation prevents accidental replacement on rerun.
    writeFileSync(secretPath, JSON.stringify(secrets), { flag: 'wx', mode: 0o600 });
    try {
      const result = await prisma.$transaction(async tx => {
        const campus = await tx.campus.findFirst({ where: {
          id: existingCampus[0].id, code: 'CAUAYAN', active: true,
        } });
        if (!campus) throw new Error('REFUSED: preexisting QA campus changed while preparing fixtures');
        const category = await tx.category.create({ data: { name: 'Synthetic iPhone QA Books', listingType: 'physical_product' } });
        const [buyer, seller] = await Promise.all([
          tx.user.create({ data: {
            email: buyerEmail, displayName: 'QA Buyer (Synthetic)',
            passwordHash: await argon2.hash(secrets.buyer.password),
            affiliations: { create: { campusId: campus.id, verificationStatus: 'verified', verifiedAt: new Date() } },
          } }),
          tx.user.create({ data: {
            email: sellerEmail, displayName: 'QA Seller (Synthetic)',
            passwordHash: await argon2.hash(secrets.seller.password),
            affiliations: { create: { campusId: campus.id, verificationStatus: 'verified', verifiedAt: new Date() } },
          } }),
        ]);
        const store = await tx.sellerProfile.create({ data: {
          ownerUserId: seller.id, campusId: campus.id, storeName: 'Synthetic CPSU iPhone QA Store',
          description: 'Temporary test-only seller for private Safari testing.',
          sellerType: 'student', approvalStatus: 'approved',
        } });
        const listing = await tx.listing.create({ data: {
          sellerProfileId: store.id, campusId: campus.id, categoryId: category.id,
          type: 'physical_product', condition: 'good', price: 50,
          title: listingTitle, description: 'Synthetic QA item. NOT A REAL OFFER OR SALE.',
          status: 'published', availabilityState: 'available',
        } });
        return { buyerId: buyer.id, sellerId: seller.id, listingId: listing.id,
          sellerProfileId: store.id, campusId: campus.id, categoryId: category.id };
      });
      Object.assign(secrets, {
        buyer: { ...secrets.buyer, id: result.buyerId }, seller: { ...secrets.seller, id: result.sellerId },
        listingId: result.listingId, sellerProfileId: result.sellerProfileId,
        campusId: result.campusId, categoryId: result.categoryId,
      });
      writeFileSync(secretPath, JSON.stringify(secrets), { flag: 'w', mode: 0o600 });
      await assertFixtureMatches(secrets);
      console.log('PASS: created exactly two synthetic students, one category, one approved store and one published listing in isolated iPhone QA schema; existing Cauayan campus reused untouched.');
      console.log('PASS: private credentials stored outside the repository (never printed).');
      console.log('QA listing ID: ' + result.listingId + '. Synthetic user passwords are NOT in this output.');
    } catch (error) {
      // A transaction failure rolls back all database inserts. If the transaction
      // committed but credential rewrite failed, leave the record for safe recovery.
      const rows = await prisma.user.count({ where: { email: { in: [buyerEmail, sellerEmail] } } });
      if (rows === 0 && existsSync(secretPath)) unlinkSync(secretPath);
      throw error;
    }
  } else if (mode === 'verify') {
    const s = readSecret();
    await assertFixtureMatches(s);
    const counts = await fixtureCounts();
    if (counts.users !== 2 || counts.campuses !== 1 || counts.categories !== 1 ||
        counts.sellers !== 1 || counts.listings !== 1) {
      throw new Error('REFUSED: QA fixture shape changed. Verify ownership before testing.');
    }
    console.log('PASS: isolated QA fixture present; two synthetic users and one synthetic published listing.');
    console.log('QA listing ID: ' + s.listingId + '. No passwords displayed.');
  } else {
    const s = readSecret();
    await assertFixtureMatches(s);
    // Do not delete anything if additional users/listings appeared, to avoid
    // touching a separate agent's test identities.
    const counts = await fixtureCounts();
    if (counts.users !== 2 || counts.campuses !== 1 || counts.categories !== 1 ||
        counts.sellers !== 1 || counts.listings !== 1) {
      throw new Error('REFUSED: additional QA rows exist; requires owner review for safe cleanup.');
    }
    const ids = [s.buyer.id!, s.seller.id!];
    await prisma.$transaction(async tx => {
      const threadIds = (await tx.inquiryThread.findMany({ where: { listingId: s.listingId }, select: { id: true } })).map(x => x.id);
      const transactions = (await tx.transaction.findMany({ where: { listingId: s.listingId }, select: { id: true } })).map(x => x.id);
      await tx.transactionStatusLog.deleteMany({ where: { transactionId: { in: transactions } } });
      await tx.listing.update({ where: { id: s.listingId }, data: { reservationTransactionId: null } });
      await tx.transaction.deleteMany({ where: { id: { in: transactions } } });
      await tx.inquiryMessage.deleteMany({ where: { threadId: { in: threadIds } } });
      await tx.handoff.deleteMany({ where: { inquiryThreadId: { in: threadIds } } });
      await tx.inquiryThread.deleteMany({ where: { id: { in: threadIds } } });
      await tx.listingReview.deleteMany({ where: { listingId: s.listingId } });
      await tx.listingMedia.deleteMany({ where: { listingId: s.listingId } });
      await tx.savedListing.deleteMany({ where: { listingId: s.listingId } });
      await tx.report.deleteMany({ where: { OR: [{ listingId: s.listingId }, { sellerProfileId: s.sellerProfileId }, { reporterUserId: { in: ids } }] } });
      await tx.notification.deleteMany({ where: { userId: { in: ids } } });
      await tx.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await tx.pushSubscription.deleteMany({ where: { userId: { in: ids } } });
      await tx.pushPreference.deleteMany({ where: { userId: { in: ids } } });
      await tx.session.deleteMany({ where: { userId: { in: ids } } });
      await tx.userRole.deleteMany({ where: { userId: { in: ids } } });
      await tx.affiliation.deleteMany({ where: { userId: { in: ids } } });
      await tx.listing.delete({ where: { id: s.listingId } });
      await tx.sellerProfile.delete({ where: { id: s.sellerProfileId } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
      await tx.category.delete({ where: { id: s.categoryId } });
      // Existing CPSU Cauayan campus predates this fixture and is never deleted.
    });
    unlinkSync(secretPath);
    console.log('PASS: approved synthetic iPhone QA identities and linked test-only rows cleaned. Private credential file removed.');
  }
} finally {
  await prisma.$disconnect();
}
