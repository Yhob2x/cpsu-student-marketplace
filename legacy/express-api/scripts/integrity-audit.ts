/**
 * Read-only database integrity audit. Run solely against cpsu_marketplace_test
 * using the guarded Stage 1 runner; no DDL or data repair performed.
 */
import { PrismaClient } from '@prisma/client';
const uri = new URL(process.env.DATABASE_URL || '');
const database = decodeURIComponent(uri.pathname.replace(/^\//, ''));
if (process.env.NODE_ENV !== 'test' || process.env.CPSU_INTEGRATION_TESTS !== '1' ||
    database !== 'cpsu_marketplace_test' ||
    !['localhost', '127.0.0.1', '::1'].includes(uri.hostname)) {
  throw new Error('Integrity audit requires the isolated local CPSU test database.');
}
const db = new PrismaClient();
const relations: [string, string, string, string][] = [
  ['Session', 'userId', 'User', 'id'],
  ['UserRole', 'campusId', 'Campus', 'id'],
  ['ListingReview', 'listingId', 'Listing', 'id'],
  ['ListingReview', 'reviewerId', 'User', 'id'],
  ['Handoff', 'inquiryThreadId', 'InquiryThread', 'id'],
  ['SavedListing', 'userId', 'User', 'id'],
  ['Report', 'reporterUserId', 'User', 'id'],
  ['Notification', 'userId', 'User', 'id'],
  ['InquiryThread', 'buyerUserId', 'User', 'id'],
  ['Category', 'parentId', 'Category', 'id'],
];
type Row = Record<string, any>;
try {
  console.log('Stage 1 read-only integrity audit: ' + database);
  const keys = await db.$queryRawUnsafe<Row[]>(
    'SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME ' +
    'FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL'
  );
  let missing = 0;
  for (const [table, column, target, targetCol] of relations) {
    const found = keys.some(k => String(k.TABLE_NAME).toLowerCase() === table.toLowerCase() &&
      String(k.COLUMN_NAME).toLowerCase() === column.toLowerCase() &&
      String(k.REFERENCED_TABLE_NAME).toLowerCase() === target.toLowerCase() &&
      String(k.REFERENCED_COLUMN_NAME).toLowerCase() === targetCol.toLowerCase());
    if (!found) missing++;
    // These are known schema gaps; do not attempt any repair.
    const sql = 'SELECT COUNT(*) AS n FROM \`' + table + '\` child LEFT JOIN \`' + target +
      '\` parent ON child.\`' + column + '\` = parent.\`' + targetCol +
      '\` WHERE child.\`' + column + '\` IS NOT NULL AND parent.\`' + targetCol + '\` IS NULL';
    const count = await db.$queryRawUnsafe<Row[]>(sql);
    console.log((found ? 'FK present: ' : 'FK missing: ') + table + '.' + column +
      ' -> ' + target + '.' + targetCol + ' | orphan rows: ' + String(count[0]?.n ?? '?'));
  }
  const indexes = await db.$queryRawUnsafe<Row[]>(
    'SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME, SEQ_IN_INDEX', 'Listing'
  );
  console.log('Listing indexes: ' + JSON.stringify(indexes, (_key, value) => typeof value === 'bigint' ? Number(value) : value));
  console.log('Known missing FK targets in this audit: ' + missing + '/' + relations.length);
  console.log('No constraints were created, changed, or removed.');
} finally {
  await db.$disconnect();
}
