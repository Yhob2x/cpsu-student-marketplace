/**
 * READ-ONLY stock/appreciation activation preflight.
 * Does not query student identities, names, contact data, or message contents.
 * No CREATE/ALTER/DROP/DML permitted. Run from apps/api with Bun.
 */
import { PrismaClient } from '@prisma/client';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
if (process.argv.length !== 3 || process.argv[2] !== '--audit-only' || process.env.NODE_ENV === 'production')
  throw Error('REFUSED: --audit-only required outside production');
const u = new URL(process.env.DATABASE_URL ?? 'mysql://invalid');
if (u.protocol !== 'mysql:' || u.hostname !== '127.0.0.1' ||
  (u.port && u.port !== '3306') || u.pathname !== '/cpsu_marketplace' ||
  u.search || u.hash) throw Error('REFUSED: local CPSU development database required');
const migrationsRoot = resolve(import.meta.dir, '../prisma/migrations');
const files = new Map(readdirSync(migrationsRoot, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(migrationsRoot,e.name,'migration.sql')))
  .map(e => [e.name, join(migrationsRoot,e.name,'migration.sql')]));
const prisma = new PrismaClient({ datasources: { db: { url: u.toString() } } });
let blocked = false;
const count = (v: bigint | number | string) => Number(v);
try {
  const identity = await prisma.$queryRawUnsafe<Array<{ name: string }>>('SELECT DATABASE() AS name');
  if (identity[0]?.name !== 'cpsu_marketplace') throw Error('STOP: database identity mismatch');
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  const existing = new Set(tables.map(t => t.name.toLowerCase()));
  const history = await prisma.$queryRawUnsafe<Array<{
    migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null;
  }>>('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at');
  const completed = new Map<string, string>();
  for (const m of history) {
    if (!m.finished_at && !m.rolled_back_at) { console.log('INCOMPLETE_MIGRATION: '+m.migration_name); blocked = true; }
    if (m.finished_at && !m.rolled_back_at) {
      completed.set(m.migration_name,m.checksum);
      const file = files.get(m.migration_name);
      if (!file) { console.log('UNTRACKED_MIGRATION_LEDGER: '+m.migration_name); blocked = true; continue; }
      const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
      if (actual !== m.checksum) {
        console.log('MIGRATION_CHECKSUM_CHANGED: '+m.migration_name);
        blocked = true;
      }
    }
  }
  const pending = [...files.keys()].filter(name => !completed.has(name)).sort();
  console.log('SCHEMA_READONLY_PREFLIGHT: cpsu_marketplace at 127.0.0.1:3306');
  console.log('MIGRATIONS: source files='+files.size+' completed ledger entries='+completed.size);
  console.log('PENDING_MIGRATIONS: '+(pending.join(', ') || 'none'));
  const targetMigration = '20261123164500_listing_stock_and_appreciations';
  const requiredPending = ['20261117230000_private_student_identity',
    '20261119150000_push_delivery_outbox',targetMigration];
  for (const name of requiredPending) {
    if (pending.includes(name)) blocked = true;
  }
  const listing = await prisma.$queryRawUnsafe<Array<{
    type: string; availabilityState: string; qty: bigint; held: bigint;
  }>>(`SELECT type,availabilityState,COUNT(*) AS qty,
    SUM(CASE WHEN reservationTransactionId IS NULL THEN 0 ELSE 1 END) AS held
    FROM Listing GROUP BY type,availabilityState ORDER BY type,availabilityState`);
  console.log('LISTING_STATE_AGGREGATES (no listing identities):');
  for (const r of listing) console.log('  '+r.type+' / '+r.availabilityState+': '+count(r.qty)+' rows; legacy held='+count(r.held));
  const types = ['ListingInventory','ListingAppreciation','StudentIdentity','PushOutbox'];
  console.log('ACTIVATION_TABLES: '+types.map(n=>n+'='+existing.has(n.toLowerCase())).join(' '));
  const physical = listing.filter(r=>r.type==='physical_product').reduce((n,r)=>n+count(r.qty),0);
  const reserved = listing.filter(r=>r.type==='physical_product').reduce((n,r)=>n+count(r.held),0);
  console.log('PHYSICAL_BACKFILL_EXPECTATION: inventory rows='+physical+'; legacy held units='+reserved);
  // In-flight transaction statuses are aggregate only, with no student identities.
  const transactions = await prisma.$queryRawUnsafe<Array<{status:string;qty:bigint}>>(
    'SELECT status,COUNT(*) AS qty FROM Transaction GROUP BY status ORDER BY status');
  console.log('TRANSACTION_STATE_COUNTS: '+transactions.map(t=>t.status+'='+count(t.qty)).join(', '));
  const joined = await prisma.$queryRawUnsafe<Array<{ status: string; type: string; qty: bigint }>>(
    'SELECT t.status,l.type,COUNT(*) AS qty FROM Transaction t JOIN Listing l ON l.id=t.listingId GROUP BY t.status,l.type ORDER BY t.status,l.type');
  console.log('TRANSACTION_TYPE_COUNTS: '+joined.map(t=>t.status+'/'+t.type+'='+count(t.qty)).join(', '));
  const unheld = await prisma.$queryRawUnsafe<Array<{qty:bigint}>>(
    `SELECT COUNT(*) AS qty FROM Transaction t JOIN Listing l ON l.id=t.listingId
      WHERE l.type='physical_product' AND t.status IN ('accepted','negotiating','for_meetup')
        AND (l.reservationTransactionId IS NULL OR l.reservationTransactionId<>t.id)`);
  console.log('ACTIVE_PHYSICAL_RESERVATION_MISMATCHES: '+count(unheld[0]?.qty??0));
  if (count(unheld[0]?.qty??0)) { blocked = true; console.log('BLOCKED: reconcile legacy physical reservations first'); }
  if (existing.has('listinginventory') !== existing.has('listingappreciation')) {
    console.log('PARTIAL_STOCK_ACTIVATION: only one of two required tables exists'); blocked = true;
  }
  const activeStock = completed.has(targetMigration) && existing.has('listinginventory') && existing.has('listingappreciation');
  console.log('TARGET_STOCK_APPRECIATION: '+(activeStock?'ACTIVE_ON_DEV':completed.has(targetMigration)?'LEDGER_BUT_MISSING_TABLES':'PENDING'));
  if (completed.has(targetMigration) && !activeStock) blocked = true;
  if (pending.length) {
    console.log('BLOCKED: pending migrations require separate approvals and real backup/restore rehearsal');
    blocked = true;
  }
  console.log('REMAINING_MIGRATION_REVIEW_GATE: '+(blocked?'BLOCKED':'READONLY_PREFLIGHT_PASSED'));
  console.log('TARGET_STOCK_GATE: '+(activeStock?'ACTIVATED':'NOT_ACTIVATED'));
  if (blocked) process.exitCode=2;
} finally { await prisma.$disconnect(); }
