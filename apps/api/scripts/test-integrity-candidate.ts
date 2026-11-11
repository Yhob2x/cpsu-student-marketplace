/**
 * Stage 1 candidate migration rehearsal on a NEW disposable local MySQL database.
 * Run from apps/api: bun scripts/test-integrity-candidate.ts --sandbox
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BASE_DB = 'cpsu_marketplace';
const SANDBOX_DB = 'cpsu_marketplace_stage1_fk_candidate';
const Q = (n: string) => String.fromCharCode(96) + n + String.fromCharCode(96);
if (process.argv[2] !== '--sandbox' || process.env.NODE_ENV === 'production') {
  throw new Error('Explicit --sandbox flag and nonproduction mode required.');
}
const source = process.env.DATABASE_URL;
if (!source) throw new Error('Missing DATABASE_URL.');
const devURL = new URL(source);
if (!['localhost', '127.0.0.1', '::1'].includes(devURL.hostname) ||
  decodeURIComponent(devURL.pathname.replace(/^\//, '')) !== BASE_DB) {
  throw new Error('Only local cpsu_marketplace may provision a Stage 1 sandbox.');
}
const sandboxURL = new URL(devURL.toString());
sandboxURL.pathname = '/' + SANDBOX_DB;
const sandboxEnv = { ...process.env, DATABASE_URL: sandboxURL.toString(), NODE_ENV: 'test' };
const admin = new PrismaClient({ datasources: { db: { url: devURL.toString() } } });

async function run(label: string, argv: string[]) {
  console.log('SANDBOX: ' + label);
  const child = Bun.spawn(argv, {
    cwd: path.resolve(import.meta.dir, '..'), env: sandboxEnv, stdout: 'inherit', stderr: 'inherit',
  });
  if (await child.exited !== 0) throw new Error(label + ' failed.');
}
function assertSafeSQL(sql: string) {
  const statements = sql.replace(/--[^\r\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
  const fks = statements.filter(s => /^ALTER TABLE \x60\w+\x60 ADD CONSTRAINT \x60\w+\x60 FOREIGN KEY /i.test(s));
  const indexes = statements.filter(s => /^CREATE INDEX \x60Listing_discovery_idx\x60 ON \x60Listing\x60/i.test(s));
  if (statements.length !== 20 || fks.length !== 19 || indexes.length !== 1) {
    throw new Error('Candidate SQL differs from exactly 19 FKs and 1 index.');
  }
  if (statements.some(s => /^(DROP|TRUNCATE|DELETE|UPDATE|RENAME|MODIFY|CHANGE)\b/i.test(s))) {
    throw new Error('Destructive or data-update statement in candidate SQL.');
  }
  return statements;
}
type Row = Record<string, any>;
async function countRows(db: PrismaClient) {
  const tables = ['Campus','Category','User','Affiliation','UserRole','Session','CampusPolicy','RestrictedCategory',
    'SellerProfile','Listing','ListingMedia','ListingReview','InquiryThread','InquiryMessage','Handoff',
    'SavedListing','Report','AuditLog','Notification'];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await db.$queryRawUnsafe<Row[]>('SELECT COUNT(*) AS n FROM ' + Q(table));
    counts[table] = Number(rows[0].n);
  }
  return counts;
}
async function seed(db: PrismaClient) {
  const campus = await db.campus.create({ data: { code: 'S1C', name: 'Stage 1 fake campus' } });
  const category = await db.category.create({ data: { name: 'Stage1 parent', listingType: 'physical_product' } });
  await db.category.create({ data: { name: 'Stage1 child', parentId: category.id, listingType: 'physical_product' } });
  const user = await db.user.create({ data: { email: 'sandbox@invalid.test', displayName: 'Sandbox user',
    passwordHash: 'not-a-real-credential' } });
  const reviewer = await db.user.create({ data: { email: 'reviewer@invalid.test', displayName: 'Sandbox reviewer',
    passwordHash: 'not-a-real-credential' } });
  await db.affiliation.create({ data: { userId: user.id, campusId: campus.id, verificationStatus: 'verified' } });
  await db.userRole.create({ data: { userId: reviewer.id, campusId: campus.id, role: 'campus_reviewer' } });
  await db.session.create({ data: { userId: user.id, refreshTokenHash: 'sandbox-token-hash',
    expiresAt: new Date('2027-01-01') } });
  const policy = await db.campusPolicy.create({ data: { campusId: campus.id, version: 1,
    effectiveDate: new Date('2026-01-01'), approvedBy: 'SANDBOX', documentRef: 'sandbox' } });
  await db.restrictedCategory.create({ data: { campusId: campus.id, categoryId: category.id,
    policyAction: 'review', policyVersionId: policy.id } });
  const store = await db.sellerProfile.create({ data: { ownerUserId: user.id, campusId: campus.id,
    storeName: 'Sandbox store', description: 'Fake fixture', approvalStatus: 'approved' } });
  const listing = await db.listing.create({ data: { sellerProfileId: store.id, campusId: campus.id,
    categoryId: category.id, type: 'physical_product', title: 'Sandbox listing', description: 'Sample only',
    price: 200, status: 'published' } });
  await db.listingMedia.create({ data: { listingId: listing.id, mediaPath: 'sandbox.jpg', mimeType: 'image/jpeg' } });
  await db.listingReview.create({ data: { listingId: listing.id, reviewerId: reviewer.id,
    policyVersionId: policy.id, decision: 'approved', reason: 'Sandbox review' } });
  const inquiry = await db.inquiryThread.create({ data: { listingId: listing.id, buyerUserId: reviewer.id,
    sellerProfileId: store.id } });
  await db.inquiryMessage.create({ data: { threadId: inquiry.id, authorUserId: reviewer.id,
    body: 'Sandbox message' } });
  await db.handoff.create({ data: { inquiryThreadId: inquiry.id, method: 'campus_pickup',
    timeWindow: 'Tomorrow', generalLocation: 'Sandbox', status: 'proposed' } });
  await db.savedListing.create({ data: { userId: reviewer.id, listingId: listing.id } });
  await db.report.create({ data: { reporterUserId: reviewer.id, listingId: listing.id,
    sellerProfileId: store.id, assignedReviewerId: user.id, reason: 'Sandbox report only' } });
  await db.auditLog.create({ data: { actorUserId: reviewer.id, action: 'sandbox',
    targetType: 'listing', targetId: listing.id } });
  await db.notification.create({ data: { userId: user.id, type: 'sandbox', payload: {} } });
  const auditOnlyUser = await db.user.create({ data: { email: 'audit-only@invalid.test',
    displayName: 'Audit only', passwordHash: 'not-a-real-credential' } });
  await db.auditLog.create({ data: { actorUserId: auditOnlyUser.id, action: 'sandbox',
    targetType: 'user', targetId: auditOnlyUser.id } });
  return { auditOnlyUserId: auditOnlyUser.id };
}

const sqlPath = path.resolve(import.meta.dir, '../prisma/candidates/stage1-integrity/candidate.sql');
const statements = assertSafeSQL(readFileSync(sqlPath, 'utf8'));
const preexisting = await admin.$queryRawUnsafe<Row[]>(
  'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', SANDBOX_DB
);
if (preexisting.length) throw new Error('Sandbox database already exists. Refusing to overwrite: ' + SANDBOX_DB);
let createdThisRun = false;
try {
  await admin.$executeRawUnsafe(
    'CREATE DATABASE ' + Q(SANDBOX_DB) + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  );
  createdThisRun = true;
  await run('deploy ONLY baseline migrations', ['bunx', 'prisma', 'migrate', 'deploy']);
  const db = new PrismaClient({ datasources: { db: { url: sandboxURL.toString() } } });
  try {
    const selected = await db.$queryRawUnsafe<Row[]>('SELECT DATABASE() AS name');
    if (selected[0]?.name !== SANDBOX_DB) throw new Error('Unexpected sandbox connection!');
    const fixture = await seed(db);
    const before = await countRows(db);
    console.log('SANDBOX: fixture row counts before: ' + JSON.stringify(before));
    for (const [i, sql] of statements.entries()) {
      await db.$executeRawUnsafe(sql);
      console.log('SANDBOX: applied statement ' + (i + 1) + '/' + statements.length);
    }
    const after = await countRows(db);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Unexpected row-count change!');
    const fks = await db.$queryRawUnsafe<Row[]>(
      'SELECT CONSTRAINT_NAME, TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE ' +
      'WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'
    );
    const newKeys = fks.filter(x => statements.some(s =>
      s.includes('ADD CONSTRAINT ' + Q(String(x.CONSTRAINT_NAME)))));
    if (newKeys.length !== 19) throw new Error('Expected 19 new FKs, found ' + newKeys.length);
    const discovery = await db.$queryRawUnsafe<Row[]>(
      'SELECT COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS ' +
      "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Listing' AND INDEX_NAME = 'Listing_discovery_idx' ORDER BY SEQ_IN_INDEX"
    );
    if (discovery.map(r => r.COLUMN_NAME).join(',') !== 'status,categoryId,campusId,createdAt') {
      throw new Error('Discovery index mismatch.');
    }
    const rejectedOrphan = await db.notification.create({ data: { userId: 2147483647, type: 'invalid-parent' } })
      .then(() => false, () => true);
    if (!rejectedOrphan) throw new Error('Expected orphan notification FK rejection.');
    const auditProtected = await db.user.delete({ where: { id: fixture.auditOnlyUserId } })
      .then(() => false, () => true);
    if (!auditProtected) throw new Error('Audit-actor row was deleted unexpectedly.');
    console.log('SANDBOX SUCCESS: 19 FKs + index; all records preserved; orphan blocked; audited user protected.');
  } finally {
    await db.$disconnect();
  }
} finally {
  // Drop only the disposable schema created during THIS process; never existing schemas.
  if (createdThisRun) {
    await admin.$executeRawUnsafe('DROP DATABASE ' + Q(SANDBOX_DB));
    console.log('SANDBOX CLEANUP: only ' + SANDBOX_DB + ' was dropped.');
  }
  await admin.$disconnect();
}
console.log('DEVELOPMENT/PRODUCTION DATABASES UNCHANGED.');
