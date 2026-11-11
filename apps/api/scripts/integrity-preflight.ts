/**
 * Stage 1 preflight: SELECT-only audit against the local development schema.
 * Does not migrate, alter, backfill, delete, or expose personal student records.
 * Run: bun scripts/integrity-preflight.ts --audit-only
 */
import { PrismaClient } from '@prisma/client';

if (process.argv[2] !== '--audit-only') {
  throw new Error('Explicit --audit-only flag required.');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing production-mode access.');
}
const url = new URL(process.env.DATABASE_URL ?? '');
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (dbName !== 'cpsu_marketplace' || !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  throw new Error('This audit is restricted to the local cpsu_marketplace development schema.');
}

// Whitelist table/column names: none is supplied by user input or the database.
const refs = [
  ['Session', 'userId', 'User', 'id'],
  ['UserRole', 'campusId', 'Campus', 'id'],
  ['ListingReview', 'listingId', 'Listing', 'id'],
  ['ListingReview', 'reviewerId', 'User', 'id'],
  ['ListingReview', 'policyVersionId', 'CampusPolicy', 'id'],
  ['Handoff', 'inquiryThreadId', 'InquiryThread', 'id'],
  ['SavedListing', 'userId', 'User', 'id'],
  ['Report', 'reporterUserId', 'User', 'id'],
  ['Report', 'listingId', 'Listing', 'id'],
  ['Report', 'sellerProfileId', 'SellerProfile', 'id'],
  ['Report', 'assignedReviewerId', 'User', 'id'],
  ['Notification', 'userId', 'User', 'id'],
  ['InquiryThread', 'buyerUserId', 'User', 'id'],
  ['Category', 'parentId', 'Category', 'id'],
  ['CampusPolicy', 'campusId', 'Campus', 'id'],
  ['RestrictedCategory', 'campusId', 'Campus', 'id'],
  ['RestrictedCategory', 'categoryId', 'Category', 'id'],
  ['SellerProfile', 'campusId', 'Campus', 'id'],
  ['AuditLog', 'actorUserId', 'User', 'id'],
] as const;
type Row = Record<string, unknown>;
const db = new PrismaClient();
const q = (identifier: string) => String.fromCharCode(96) + identifier + String.fromCharCode(96);

try {
  const current = await db.$queryRawUnsafe<Row[]>('SELECT DATABASE() AS name');
  if (current[0]?.name !== dbName) throw new Error('Unexpected database selected at query time.');
  console.log('READ-ONLY SCHEMA AUDIT: ' + dbName + ' @ ' + url.hostname);
  const keys = await db.$queryRawUnsafe<Row[]>(
    'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME ' +
    'FROM information_schema.KEY_COLUMN_USAGE ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'
  );
  let missing = 0;
  let orphaned = 0;
  for (const [child, column, parent, parentId] of refs) {
    const exists = keys.some(k =>
      String(k.TABLE_NAME).toLowerCase() === child.toLowerCase() &&
      String(k.COLUMN_NAME).toLowerCase() === column.toLowerCase() &&
      String(k.REFERENCED_TABLE_NAME).toLowerCase() === parent.toLowerCase() &&
      String(k.REFERENCED_COLUMN_NAME).toLowerCase() === parentId.toLowerCase());
    // Dynamic identifiers above come only from the source-code whitelist.
    const counts = await db.$queryRawUnsafe<Row[]>(
      'SELECT COUNT(*) AS n FROM ' + q(child) + ' c LEFT JOIN ' + q(parent) +
      ' p ON c.' + q(column) + ' = p.' + q(parentId) +
      ' WHERE c.' + q(column) + ' IS NOT NULL AND p.' + q(parentId) + ' IS NULL'
    );
    const n = Number(counts[0]?.n ?? 0);
    if (!exists) missing++;
    orphaned += n;
    console.log((exists ? 'FK PRESENT' : 'FK MISSING') + ' ' + child + '.' + column +
      ' -> ' + parent + '.' + parentId + '; orphan rows: ' + n);
  }
  const indexRows = await db.$queryRawUnsafe<Row[]>(
    'SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS ' +
    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Listing' ORDER BY INDEX_NAME, SEQ_IN_INDEX"
  );
  const indexMap = new Map<string, string[]>();
  for (const index of indexRows) {
    const name = String(index.INDEX_NAME);
    const fields = indexMap.get(name) ?? [];
    fields.push(String(index.COLUMN_NAME));
    indexMap.set(name, fields);
  }
  for (const [name, columns] of indexMap) console.log('LISTING INDEX ' + name + ': ' + columns.join(','));
  const target = ['status', 'categoryId', 'campusId', 'createdAt'];
  const hasDiscoveryIndex = [...indexMap.values()].some(fields => target.every((name, i) => fields[i] === name));
  console.log('Proposed composite discovery index already present: ' + hasDiscoveryIndex);
  console.log('TOTAL checked=' + refs.length + ', FK missing=' + missing + ', orphan rows=' + orphaned);
  console.log('NO DATA OR SCHEMA MODIFICATIONS PERFORMED.');
} finally {
  await db.$disconnect();
}
