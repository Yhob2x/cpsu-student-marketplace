/**
 * Executes ONLY approved StoreReview DDL against local CPSU development database.
 * Requires prior verified DPAPI encrypted full backup and disposable restore.
 * Does not mark Prisma migration history (second gate: migrate resolve manually).
 * Run from apps/api: bun scripts/apply-store-reviews-approved-dev.ts --approved-store-reviews-only
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';

if (process.argv.length !== 3 || process.argv[2] !== '--approved-store-reviews-only') throw Error('REFUSED: exact approval flag required');
if (process.env.NODE_ENV === 'production') throw Error('REFUSED: production forbidden');
const raw = process.env.DATABASE_URL;
if (!raw) throw Error('REFUSED: DATABASE_URL missing');
const uri = new URL(raw);
if (uri.protocol !== 'mysql:' || uri.hostname !== '127.0.0.1' || (uri.port && uri.port !== '3306') ||
  decodeURIComponent(uri.pathname.slice(1)) !== 'cpsu_marketplace')
  throw Error('REFUSED: not the approved local development database');
const path = resolve(import.meta.dir, '../prisma/migrations/20261118160000_store_reviews/migration.sql');
const file = readFileSync(path,'utf8');
const statements = file.replace(/\r/g,'').split('\n').filter(line => !/^\s*--/.test(line)).join('\n').trim();
if (!/^CREATE TABLE `StoreReview` \(/.test(statements) || (statements.match(/;/g) || []).length !== 1 ||
  !statements.endsWith(';') || !statements.includes('CONSTRAINT `StoreReview_rating_range_chk`') ||
  !statements.includes('UNIQUE INDEX `StoreReview_transactionId_key`') ||
  /\b(DROP|ALTER|TRUNCATE|INSERT)\b/i.test(statements) ||
  /\bDELETE\s+FROM\b/i.test(statements) || /\bUPDATE\s+`?\w+`?\s+SET\b/i.test(statements))
  throw Error('REFUSED: migration contains something other than approved additive StoreReview table');

const backup = String(process.env.CPSU_REVIEW_BACKUP_MANIFEST || '');
if (!backup) throw Error('REFUSED: explicit private restored-backup manifest path required');
const meta = JSON.parse(readFileSync(backup,'utf8'));
if (meta.state !== 'RESTORE_VERIFIED' || meta.sourceDatabase !== 'cpsu_marketplace' ||
  meta.purpose !== 'CPSU local StoreReview-only approved development migration' ||
  meta.sourceTableCount < 20 || !meta.dumpSha256 || !meta.encryptedSha256)
  throw Error('REFUSED: invalid backup restoration attestation');
const encrypted = join(dirname(backup),'dev-backup.dpapi');
if (!existsSync(encrypted)) throw Error('REFUSED: encrypted local backup missing');
const hash = createHash('sha256').update(readFileSync(encrypted)).digest('hex');
if (hash !== meta.encryptedSha256) throw Error('REFUSED: encrypted backup integrity mismatch');
const db = new PrismaClient();
try {
  const ident = await db.$queryRawUnsafe<Array<{db: string}>>('SELECT DATABASE() AS db');
  if (ident[0]?.db !== 'cpsu_marketplace') throw Error('REFUSED: datasource identity mismatch');
  const items = await db.$queryRawUnsafe<Array<{name: string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='storereview'");
  if (items.length) throw Error('REFUSED: StoreReview already exists; will not overwrite or retry DDL');
  const marked = await db.$queryRawUnsafe<Array<{name: string}>>(
    "SELECT migration_name AS name FROM _prisma_migrations WHERE migration_name='20261118160000_store_reviews' AND finished_at IS NOT NULL");
  if (marked.length) throw Error('REFUSED: Prisma history already says migration applied');
  const maria = 'C:\\xampp\\mysql\\bin\\mysql.exe';
  const args = ['--protocol=TCP','--host=127.0.0.1','--port=3306',
    '--user='+decodeURIComponent(uri.username),'--database=cpsu_marketplace'];
  const r = spawnSync(maria,args,{env:{...process.env,MYSQL_PWD:decodeURIComponent(uri.password)},
    input:file,encoding:'utf8',windowsHide:true,timeout:30000});
  if (r.error || r.status !== 0) throw Error('StoreReview DDL did not complete (exit '+r.status+'); inspect database before any retry');
  const post = await db.$queryRawUnsafe<Array<{name: string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='storereview'");
  if (post.length !== 1) throw Error('DDL executed but StoreReview table not found');
  const constraints = await db.$queryRawUnsafe<Array<{name:string}>>(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='storereview'");
  for (const check of ['PRIMARY','StoreReview_transactionId_key','StoreReview_rating_range_chk','StoreReview_transactionId_fkey',
    'StoreReview_sellerProfileId_fkey','StoreReview_buyerUserId_fkey']) {
    if (!constraints.some(v=>v.name.toLowerCase()===check.toLowerCase())) throw Error('StoreReview constraint missing: '+check);
  }
  const rows = await db.$queryRawUnsafe<Array<{n: bigint}>>('SELECT COUNT(*) AS n FROM `StoreReview`');
  if (Number(rows[0]?.n) !== 0) throw Error('Unexpected StoreReview data before first activation');
  console.log('STORE_REVIEWS_DEV_DDL_PASS table=StoreReview constraints='+constraints.length+' initialRows=0 database=cpsu_marketplace');
  console.log('PRISMA_HISTORY_PENDING: Run ONLY "bunx prisma migrate resolve --applied 20261118160000_store_reviews" next');
} finally { await db.$disconnect(); }
