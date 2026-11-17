// Disposable, temporary-table SQL rehearsal. Never modifies an existing table.
// Requires local test database and reviewed one-column avatar migration source.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(import.meta.dir,
  '../prisma/migrations/20261117123000_seller_avatar_review/migration.sql'), 'utf8');
const sql = source.split(/\r?\n/).filter(s => !/^\s*--/.test(s)).join('\n').trim();
const expected = 'ALTER TABLE `SellerProfile`\n  ADD COLUMN `avatarPath` VARCHAR(255) NULL;';
if (sql !== expected) throw new Error('REFUSED: migration is not exact reviewed SQL.');
const supplied = process.env.DATABASE_URL;
if (!supplied) throw new Error('REFUSED: DATABASE_URL is missing.');
const url = new URL(supplied);
if (url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' ||
    !['','3306'].includes(url.port) || decodeURIComponent(url.pathname.slice(1)) !== 'cpsu_marketplace')
  throw new Error('REFUSED: expected local app source database identity.');
url.pathname = '/cpsu_marketplace_test';
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const table = '_cpsu_avatar_temporary_probe';
const candidate = sql.replace('`SellerProfile`', '`' + table + '`');
try {
  const result = await db.$transaction(async tx => {
    const ids = await tx.$queryRawUnsafe<{db: string}[]>('SELECT DATABASE() AS db');
    if (ids[0]?.db !== 'cpsu_marketplace_test')
      throw new Error('REFUSED: not the dedicated isolated MySQL test database.');
    const existing = await tx.$queryRawUnsafe<{Field: string}[]>('SHOW COLUMNS FROM `SellerProfile` LIKE "avatarPath"');
    if (existing.length) throw new Error('REFUSED: active test schema already has avatarPath; rehearsal requires old schema.');
    await tx.$executeRawUnsafe('CREATE TEMPORARY TABLE `' + table + '` LIKE `SellerProfile`');
    try {
      const before = await tx.$queryRawUnsafe<{Field: string}[]>('SHOW COLUMNS FROM `' + table + '` LIKE "avatarPath"');
      if (before.length) throw new Error('Unexpected avatar column before rehearsal.');
      await tx.$executeRawUnsafe(candidate);
      const after = await tx.$queryRawUnsafe<{Field: string; Type: string; Null: string}[]>(
        'SHOW COLUMNS FROM `' + table + '` LIKE "avatarPath"');
      if (after.length !== 1 || after[0].Field !== 'avatarPath' ||
          !/^varchar\(255\)$/.test(after[0].Type.toLowerCase()) || after[0].Null !== 'YES')
        throw new Error('Unexpected generated avatar field attributes.');
      return { tested: 'TEMPORARY_TABLE_ONLY', sqlApplied: true,
        column: after[0].Field, type: after[0].Type, nullable: after[0].Null === 'YES' };
    } finally {
      await tx.$executeRawUnsafe('DROP TEMPORARY TABLE IF EXISTS `' + table + '`');
    }
  });
  console.log(JSON.stringify({ status: 'PASS', ...result, persistentMigrationApplied: false }));
} finally {
  await db.$disconnect();
}
