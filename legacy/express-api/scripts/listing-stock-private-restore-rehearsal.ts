/**
 * Explicit local private backup / full restore rehearsal.
 * This creates a password-protected-by-OS-ACL backup OUTSIDE git, restores all
 * tables & rows into a new scratch schema, checks aggregates, applies and verifies
 * ONLY the additive stock/appreciation migration in scratch, then drops scratch.
 *
 * Never executes schema changes against cpsu_marketplace.
 * Run: bun scripts/listing-stock-private-restore-rehearsal.ts --backup-and-rehearse
 */
import { randomBytes, createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

function assert(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Error('STOP: '+why);
}
assert(process.argv.length === 3 && process.argv[2] === '--backup-and-rehearse', 'explicit --backup-and-rehearse required');
assert(process.env.NODE_ENV !== 'production', 'Production is not permitted');
const uri = process.env.DATABASE_URL;
assert(uri, 'DATABASE_URL missing');
const url = new URL(uri);
assert(url.protocol === 'mysql:' && url.hostname === '127.0.0.1' && (!url.port || url.port === '3306')
  && url.pathname === '/cpsu_marketplace' && !url.hash && !url.search,
  'Only local cpsu_marketplace development database is authorized');
const local = process.env.LOCALAPPDATA;
assert(local, 'LOCALAPPDATA missing; cannot place a protected local backup');
const root = join(local, 'CPSUMarket', 'private-backups');
mkdirSync(root, { recursive: true });
const whoami = spawnSync('whoami', ['/user','/fo','csv','/nh'], { encoding: 'utf8', windowsHide: true });
assert(whoami.status === 0, 'Cannot validate local Windows security identity');
const sid = whoami.stdout.match(/S-1-5-\d+(?:-\d+)+/i)?.[0];
assert(sid, 'Cannot determine current Windows user SID');
const acl = spawnSync('icacls', [root, '/inheritance:r', '/grant:r',
  '*'+sid+':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'], { encoding: 'utf8', windowsHide: true });
assert(acl.status === 0, 'Cannot protect backup directory ACL');

const mysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const dump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
assert(existsSync(mysql) && existsSync(dump), 'Local MariaDB client tools missing');
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) };
const args = ['--protocol=TCP','--host=127.0.0.1','--port=3306',
  '--user='+decodeURIComponent(url.username),'--default-character-set=utf8mb4'];
const nonce = randomBytes(10).toString('hex');
const backupPath = join(root, 'cpsu-market-private-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+nonce+'.sql');
const scratch = 'cpsu_restore_stock_'+nonce;
const migrationPath = resolve(import.meta.dir, '../prisma/migrations/20261123164500_listing_stock_and_appreciations/migration.sql');
const migration = readFileSync(migrationPath,'utf8');
assert(migration.includes('CREATE TABLE `ListingInventory`') && migration.includes('CREATE TABLE `ListingAppreciation`')
  && !/\bDROP\b/i.test(migration), 'Target migration is not the approved additive SQL');
function command(program: string, argv: string[], input?: string, fileDescriptor?: number): string {
  const child = spawnSync(program, argv, { env, windowsHide: true, encoding: 'utf8', timeout: 180000,
    maxBuffer: 12*1024*1024, ...(input === undefined ? {} : { input }),
    ...(fileDescriptor === undefined ? {} : { stdio: [fileDescriptor, 'pipe','pipe'] }) });
  if (child.status !== 0 || child.error) {
    // Never print private SQL, credentials, or backup contents.
    throw new Error('STOP: MariaDB command failed (exit '+child.status+', '+String(child.error?.message||'SQL error').slice(0,120)+')');
  }
  return (child.stdout||'').trim();
}
function query(sql: string, schema?: string) {
  return command(mysql, [...args, ...(schema?['--database='+schema]:[])], sql+'\n');
}
function count(schema: string, table: string) {
  const clean = table.replaceAll('`','``');
  return Number(query('SELECT COUNT(*) FROM `'+clean+'`;', schema).split(/\r?\n/).at(-1));
}
let scratchCreated = false;
try {
  assert(query('SELECT DATABASE();','cpsu_marketplace').split(/\r?\n/).at(-1) === 'cpsu_marketplace',
    'Source schema mismatch');
  console.log('PRIVATE_BACKUP_STARTED; source=cpsu_marketplace; restricted ACL directory');
  const backup = spawnSync(dump,
    [...args,'--single-transaction','--quick','--routines','--triggers','--events',
      '--hex-blob','--no-tablespaces','--skip-lock-tables',
      '--result-file='+backupPath,'cpsu_marketplace'],
    { env, windowsHide: true, encoding: 'utf8', timeout: 180000,
      maxBuffer: 1024*1024 });
  assert(backup.status === 0 && !backup.error, 'Full dump failed; do not activate');
  assert(statSync(backupPath).size > 4096, 'Backup file is suspiciously small');
  const fileAcl = spawnSync('icacls',[backupPath,'/inheritance:r','/grant:r',
    '*'+sid+':F', '*S-1-5-18:F'], { encoding:'utf8', windowsHide:true });
  assert(fileAcl.status===0, 'Backup file ACL was not secured');
  const sha = createHash('sha256');
  const fh = openSync(backupPath,'r');
  // Do not send backup bytes anywhere, hash locally for integrity only.
  const { readSync } = await import('node:fs');
  const buf = Buffer.allocUnsafe(1024*1024);
  try {
    let n = 0;
    while ((n = readSync(fh, buf, 0, buf.length, null)) > 0) sha.update(buf.subarray(0,n));
  } finally { closeSync(fh); }
  console.log('PRIVATE_BACKUP_VERIFIED; bytes='+statSync(backupPath).size+'; sha256='+sha.digest('hex').slice(0,16)+'…');
  query('CREATE DATABASE `'+scratch+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
  scratchCreated = true;
  const fd = openSync(backupPath,'r');
  try { command(mysql,[...args,'--database='+scratch],undefined,fd); }
  finally { closeSync(fd); }
  const srcTables = query('SHOW TABLES;', 'cpsu_marketplace').split(/\r?\n/).slice(1).filter(Boolean);
  const restoredTables = new Set(query('SHOW TABLES;',scratch).split(/\r?\n/).slice(1).filter(Boolean));
  assert(srcTables.length >= 15 && srcTables.every(t=>restoredTables.has(t)), 'Not all source tables restored');
  let compared = 0;
  for (const table of srcTables) {
    const sourceCount = count('cpsu_marketplace',table);
    const restoreCount = count(scratch,table);
    assert(sourceCount === restoreCount,'Full restore row count mismatch at table '+table+'; source changed or backup partial');
    compared++;
  }
  console.log('FULL_RESTORE_COUNTS_MATCH; tables='+compared+'; no raw private records printed');
  const productCount = Number(query("SELECT COUNT(*) FROM Listing WHERE type='physical_product';",scratch).split(/\r?\n/).at(-1));
  const held = Number(query("SELECT COUNT(*) FROM Listing WHERE type='physical_product' AND reservationTransactionId IS NOT NULL;",scratch).split(/\r?\n/).at(-1));
  query(migration,scratch);
  const rows = Number(query('SELECT COUNT(*) FROM ListingInventory;',scratch).split(/\r?\n/).at(-1));
  const hasServices = Number(query("SELECT COUNT(*) FROM ListingInventory i JOIN Listing l ON l.id=i.listingId WHERE l.type<>'physical_product';",scratch).split(/\r?\n/).at(-1));
  const heldRows = Number(query("SELECT SUM(reservedQuantity) FROM ListingInventory;",scratch).split(/\r?\n/).at(-1));
  assert(rows===productCount && hasServices===0 && heldRows===held, 'Stock backfill integrity failed');
  console.log('SCRATCH_MIGRATION_PASS; products='+productCount+'; inventory='+rows+'; held='+heldRows+'; service_inventory=0');
  console.log('PRIVATE_RESTORE_REHEARSAL_PASS; backup retained only in restricted local path');
} finally {
  if (scratchCreated) {
    query('DROP DATABASE `'+scratch+'`;');
    console.log('SCRATCH_SCHEMA_REMOVED');
  }
}
