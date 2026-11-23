/**
 * Read-only local verification for ListingViewCounter and ListingViewDedup.
 * Usage: bun scripts/listing-views-verify-activation.ts --audit-only
 * Does not read student identities or browsing digests.
 */
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

if (process.argv.length !== 3 || process.argv[2] !== '--audit-only') throw Error('Explicit --audit-only required');
if (process.env.NODE_ENV === 'production') throw Error('Production forbidden');
const raw = z.string().min(1).parse(process.env.DATABASE_URL);
const u = new URL(raw);
if (u.protocol !== 'mysql:' || u.hostname !== '127.0.0.1' ||
  (u.port && u.port !== '3306') || u.pathname !== '/cpsu_marketplace' ||
  u.search || u.hash) throw Error('Wrong database; only local CPSU development permitted');

const prisma = new PrismaClient();
try {
  const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) IN ('listingviewcounter', 'listingviewdedup')
  `;
  if (tables.length !== 2) throw Error('View storage is not fully activated');
  const columns = await prisma.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string }>>`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND LOWER(TABLE_NAME) IN ('listingviewcounter', 'listingviewdedup')
  `;
  const names = new Set(columns.map(c => c.TABLE_NAME.toLowerCase() + '.' + c.COLUMN_NAME));
  for (const required of ['listingviewcounter.listingId', 'listingviewcounter.viewCount',
    'listingviewdedup.listingId', 'listingviewdedup.viewerHash', 'listingviewdedup.createdAt']) {
    if (!names.has(required)) throw Error('View storage column missing: ' + required);
  }
  const keys = await prisma.$queryRaw<Array<{ TABLE_NAME: string; COLUMN_NAME: string }>>`
    SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'PRIMARY'
      AND LOWER(TABLE_NAME) IN ('listingviewcounter', 'listingviewdedup')
  `;
  if (keys.filter(k => k.TABLE_NAME.toLowerCase() === 'listingviewdedup').length !== 2) {
    throw Error('Dedup composite primary key is missing');
  }
  const indexes = await prisma.$queryRaw<Array<{ INDEX_NAME: string }>>`
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'listingviewdedup'
      AND COLUMN_NAME = 'createdAt'
  `;
  if (!indexes.length) throw Error('Dedup cleanup index missing');
  const rows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total FROM ListingViewCounter
  `;
  const dedup = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*) AS total FROM ListingViewDedup
  `;
  console.log('LOCAL_VIEW_STORAGE_OK: counter_rows=' + Number(rows[0].total) +
    ' dedup_rows=' + Number(dedup[0].total) +
    ' primary_key=listingId+viewerHash cleanup_index=present');
} finally { await prisma.$disconnect(); }
