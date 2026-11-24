// Read-only Prisma migration preflight for CPSU Market seller avatars.
// No data rows are fetched, no DDL/DML or migrations are executed.
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedSql = 'ALTER TABLE `SellerProfile`\n  ADD COLUMN `avatarPath` VARCHAR(255) NULL;';
const migrationPath = resolve(import.meta.dir, '../prisma/migrations/20261117123000_seller_avatar_review/migration.sql');
const sql = readFileSync(migrationPath, 'utf8');
const withoutComments = sql.split(/\r?\n/).filter(line => !/^\s*--/.test(line)).join('\n').trim();
if (withoutComments !== expectedSql) {
  throw new Error('REFUSED: seller-avatar SQL no longer matches the reviewed additive one-column migration.');
}
const urlText = process.env.DATABASE_URL;
if (!urlText) throw new Error('REFUSED: DATABASE_URL missing.');
const baseUrl = new URL(urlText);
const dbname = decodeURIComponent(baseUrl.pathname.slice(1));
if (baseUrl.protocol !== 'mysql:' || baseUrl.hostname !== '127.0.0.1' ||
    !['3306',''].includes(baseUrl.port) || dbname !== 'cpsu_marketplace') {
  throw new Error('REFUSED: expected loopback 127.0.0.1:3306/cpsu_marketplace only.');
}
console.log(JSON.stringify({
  check: 'SELLER_AVATAR_SQL_STATIC',
  result: 'PASS',
  sha256: createHash('sha256').update(sql).digest('hex'),
  operation: 'READ_ONLY',
}));

type Column = { COLUMN_NAME: string };
type Migration = { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null };
const targets = ['cpsu_marketplace', 'cpsu_marketplace_test', 'cpsu_marketplace_push_test'];
for (const target of targets) {
  const url = new URL(urlText);
  url.pathname = '/' + target;
  const client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    const names = await client.$queryRawUnsafe<{db: string}[]>('SELECT DATABASE() AS db');
    if (names[0]?.db !== target) throw new Error('Connected database identity mismatch.');
    const columns = await client.$queryRawUnsafe<Column[]>(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SellerProfile'
      AND COLUMN_NAME IN ('avatarPath', 'pendingAvatarPath')
    `);
    const present = columns.map(row => row.COLUMN_NAME).sort();
    const migration = await client.$queryRawUnsafe<Migration[]>(`
      SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations
      WHERE migration_name IN (
        '20261116220000_managed_student_content',
        '20261116221000_pending_announcement_edits',
        '20261117123000_seller_avatar_review'
      ) ORDER BY migration_name
    `);
    console.log(JSON.stringify({
      check: 'SELLER_AVATAR_DB_SCHEMA',
      database: target,
      operation: 'READ_ONLY',
      columns: present,
      migrationStates: migration.map(m => ({
        name: m.migration_name,
        applied: Boolean(m.finished_at),
        rolledBack: Boolean(m.rolled_back_at),
      })),
      avatarMigrationApplied: migration.some(m => m.migration_name === '20261117123000_seller_avatar_review' && m.finished_at),
    }));
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'query_failed';
    console.log(JSON.stringify({ check: 'SELLER_AVATAR_DB_SCHEMA', database: target, status: 'UNAVAILABLE', code, operation: 'READ_ONLY' }));
    if (target === 'cpsu_marketplace') process.exitCode = 2;
  } finally {
    await client.$disconnect();
  }
}
