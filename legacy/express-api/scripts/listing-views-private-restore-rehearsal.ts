/**
 * Local-only private backup + complete restore rehearsal for the additive view tables.
 * Uses a random disposable schema and never migrates cpsu_marketplace.
 * No private rows, credentials or browser digests are emitted in logs.
 * Usage: bun scripts/listing-views-private-restore-rehearsal.ts --backup-and-rehearse
 */
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, statSync, readFileSync, readSync } from 'node:fs';
import { join, resolve } from 'node:path';
function check(ok: unknown, message: string): asserts ok { if (!ok) throw Error('STOP: ' + message); }
check(process.argv.length === 3 && process.argv[2] === '--backup-and-rehearse',
  'Explicit --backup-and-rehearse required');
check(process.env.NODE_ENV !== 'production', 'Production database is forbidden');
const raw = process.env.DATABASE_URL;
check(raw, 'DATABASE_URL is missing');
const u = new URL(raw);
check(u.protocol === 'mysql:' && u.hostname === '127.0.0.1' &&
  (!u.port || u.port === '3306') && u.pathname === '/cpsu_marketplace' && !u.search && !u.hash,
  'Only local cpsu_marketplace may be backed up');
const base = process.env.LOCALAPPDATA;
check(base, 'LOCALAPPDATA unavailable');
const dir = join(base, 'CPSUMarket', 'private-backups');
mkdirSync(dir, { recursive: true });
const who = spawnSync('whoami', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
const sid = who.stdout.match(/S-1-5-\d+(?:-\d+)+/i)?.[0];
check(who.status === 0 && sid, 'Cannot verify current Windows SID');
check(spawnSync('icacls', [dir, '/inheritance:r', '/grant:r',
  '*'+sid+':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'],
  { encoding: 'utf8', windowsHide: true }).status === 0, 'Cannot protect backup directory');
const mysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const dump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
check(existsSync(mysql) && existsSync(dump), 'XAMPP MariaDB CLIs missing');
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) };
const args = ['--protocol=TCP', '--host=127.0.0.1', '--port=3306',
  '--user='+decodeURIComponent(u.username), '--default-character-set=utf8mb4'];
const nonce = randomBytes(10).toString('hex');
const backup = join(dir, 'cpsu-market-private-views-'+new Date().toISOString().replace(/[:.]/g, '-')+'-'+nonce+'.sql');
const scratch = 'cpsu_restore_views_' + nonce;
const migration = readFileSync(resolve(import.meta.dir, '../prisma/migrations/20261123190000_listing_views/migration.sql'), 'utf8');
check(migration.includes('CREATE TABLE `ListingViewCounter`') &&
  migration.includes('CREATE TABLE `ListingViewDedup`') &&
  !/\bDROP\b/i.test(migration), 'Migration is not the expected additive SQL');
function exec(program: string, argv: string[], input?: string, fd?: number) {
  const run = spawnSync(program, argv, { env, windowsHide: true, encoding: 'utf8',
    timeout: 180000, maxBuffer: 12 * 1024 * 1024,
    ...(input === undefined ? {} : { input }),
    ...(fd === undefined ? {} : { stdio: [fd, 'pipe', 'pipe'] }) });
  check(run.status === 0 && !run.error, 'MariaDB command failed: exit=' + run.status);
  return run.stdout.trim();
}
function sql(query: string, database?: string) {
  return exec(mysql, [...args, ...(database ? ['--database='+database] : [])], query + '\n');
}
const count = (database: string, table: string) =>
  Number(sql('SELECT COUNT(*) FROM `' + table.replaceAll('`','``') + '`;', database).split(/\r?\n/).at(-1));
let created = false;
try {
  check(sql('SELECT DATABASE();', 'cpsu_marketplace').split(/\r?\n/).at(-1) === 'cpsu_marketplace',
    'Database identity mismatch');
  console.log('PRIVATE_BACKUP_STARTED: local development only');
  const result = spawnSync(dump,
    [...args, '--single-transaction', '--quick', '--routines', '--triggers', '--events',
      '--hex-blob', '--no-tablespaces', '--skip-lock-tables',
      '--result-file='+backup, 'cpsu_marketplace'],
    { env, windowsHide: true, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 });
  check(result.status === 0 && !result.error && statSync(backup).size > 4096, 'Backup failed');
  check(spawnSync('icacls', [backup, '/inheritance:r', '/grant:r', '*'+sid+':F', '*S-1-5-18:F'],
    { encoding: 'utf8', windowsHide: true }).status === 0, 'Could not protect backup file');
  const sha = createHash('sha256');
  const file = openSync(backup, 'r');
  const buf = Buffer.allocUnsafe(1024 * 1024);
  try { let n = 0; while ((n = readSync(file, buf, 0, buf.length, null)) > 0) sha.update(buf.subarray(0,n)); }
  finally { closeSync(file); }
  console.log('PRIVATE_BACKUP_VERIFIED: bytes=' + statSync(backup).size + ' hash=' + sha.digest('hex').slice(0,16) + '…');
  sql('CREATE DATABASE ' + scratch + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  created = true;
  const fd = openSync(backup, 'r');
  try { exec(mysql, [...args, '--database='+scratch], undefined, fd); }
  finally { closeSync(fd); }
  const sourceTables = sql('SHOW TABLES;', 'cpsu_marketplace').split(/\r?\n/).slice(1).filter(Boolean);
  const scratchTables = new Set(sql('SHOW TABLES;', scratch).split(/\r?\n/).slice(1).filter(Boolean));
  check(sourceTables.length > 15 && sourceTables.every(t => scratchTables.has(t)), 'Restored schema is incomplete');
  for (const table of sourceTables) {
    check(count('cpsu_marketplace', table) === count(scratch, table),
      'Restore row counts diverged; no migration is authorized');
  }
  console.log('FULL_RESTORE_COUNTS_MATCH: tables=' + sourceTables.length);
  sql(migration, scratch);
  const v = sql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND LOWER(table_name) IN ('listingviewcounter','listingviewdedup');", scratch);
  check(v.split(/\r?\n/).at(-1) === '2', 'Expected view tables are missing');
  check(count(scratch, 'ListingViewCounter') === 0 && count(scratch, 'ListingViewDedup') === 0,
    'View totals were fabricated on existing listings');
  const id = Number(sql('SELECT MIN(id) FROM Listing;', scratch).split(/\r?\n/).at(-1));
  check(Number.isInteger(id) && id > 0, 'No existing scratch listing for FK test');
  sql('INSERT IGNORE INTO ListingViewDedup (listingId, viewerHash) VALUES ('+id+", REPEAT('a',64));", scratch);
  sql('INSERT IGNORE INTO ListingViewDedup (listingId, viewerHash) VALUES ('+id+", REPEAT('a',64));", scratch);
  check(count(scratch, 'ListingViewDedup') === 1, 'A repeated visitor created duplicate hash rows');
  sql('INSERT INTO ListingViewCounter (listingId, viewCount) VALUES ('+id+', 1);', scratch);
  check(count(scratch, 'ListingViewCounter') === 1, 'Listing counter was not saved');
  console.log('SCRATCH_VIEW_MIGRATION_PASS: independent counters, dedup key, FK, zero historic views');
  console.log('PRIVATE_RESTORE_REHEARSAL_PASS: retained restricted backup outside repository');
} finally {
  if (created) {
    sql('DROP DATABASE ' + scratch + ';');
    console.log('SCRATCH_SCHEMA_REMOVED');
  }
}
