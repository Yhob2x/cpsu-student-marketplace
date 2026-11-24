/**
 * Stage 1 backup/restore rehearsal using a NEW sandbox database and a TEMPORARY
 * private local mysqldump. No application development / production schema writes.
 *
 * From apps/api: bun scripts/verify-integrity-restore.ts --isolated-restore
 *
 * The backup contains live development data while the drill runs. It is stored
 * only under the OS temp directory, never checked in, and deleted afterward.
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, openSync, closeSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const SOURCE_DB = 'cpsu_marketplace';
const RESTORE_DB = 'cpsu_marketplace_stage1_real_restore';
const DUMP_EXE = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL_EXE = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const q = (id: string) => String.fromCharCode(96) + id + String.fromCharCode(96);
const TABLES = ['Campus','Category','User','Affiliation','UserRole','Session','CampusPolicy',
  'RestrictedCategory','SellerProfile','Listing','ListingMedia','ListingReview','InquiryThread',
  'InquiryMessage','Handoff','SavedListing','Report','AuditLog','Notification','_prisma_migrations'];
type Row = Record<string, unknown>;

if (process.argv.length !== 3 || process.argv[2] !== '--isolated-restore' ||
    process.env.NODE_ENV === 'production') {
  throw new Error('Only the explicit --isolated-restore command outside production is allowed.');
}
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL is missing.');
const sourceURL = new URL(raw);
if (!['127.0.0.1','localhost','::1'].includes(sourceURL.hostname) ||
    decodeURIComponent(sourceURL.pathname.replace(/^\//, '')) !== SOURCE_DB) {
  throw new Error('Guard rejected a nonlocal or unexpected database.');
}
const restoreURL = new URL(sourceURL.toString());
restoreURL.pathname = '/' + RESTORE_DB;
const user = decodeURIComponent(sourceURL.username);
const password = decodeURIComponent(sourceURL.password);
const common = ['--protocol=TCP', '--host=' + sourceURL.hostname,
  '--port=' + (sourceURL.port || '3306'), '--user=' + user];
const cliEnv = { ...process.env, MYSQL_PWD: password };
const source = new PrismaClient({ datasources: { db: { url: sourceURL.toString() } } });
const scratchDir = mkdtempSync(join(tmpdir(), 'cpsu-stage1-rehearsal-'));
const dumpFile = join(scratchDir, 'private-development-backup.sql');
let createdRestoreDatabase = false;
let restore: PrismaClient | undefined;
let hasFailure = false;

function runCommand(executable: string, args: string[], inputFd?: number, outputFd?: number) {
  const child = spawnSync(executable, args, {
    env: cliEnv, timeout: 120000,
    stdio: [inputFd ?? 'ignore', outputFd ?? 'ignore', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  });
  if (child.error || child.status !== 0) {
    // Avoid leaking secrets or any data from the SQL dump in error output.
    throw new Error('A local MySQL CLI command failed (exit ' + child.status +
      ', executable ' + executable.split('\\').pop() + '). Inspect MySQL access and privileges.');
  }
}

async function snapshot(prisma: PrismaClient) {
  const tables: Record<string, { count: number; digest: string }> = {};
  for (const table of TABLES) {
    const records = await prisma.$queryRawUnsafe<Row[]>('SELECT * FROM ' + q(table) + ' ORDER BY ' + q('id'));
    // Prisma migration history table uses string id, but ORDER BY id works for both.
    const normalized = JSON.stringify(records, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();
      if (value instanceof Uint8Array) return Array.from(value);
      return value;
    });
    tables[table] = {
      count: records.length,
      digest: createHash('sha256').update(normalized).digest('hex'),
    };
  }
  return tables;
}

function validateSQL(sql: string) {
  // A normal schema+data dump must NOT switch to the source database,
  // create/drop a schema or drop tables in the restored database.
  if (/(?:^|\n)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(sql)) {
    throw new Error('Unexpected destructive or database-switching SQL in temporary dump.');
  }
}

function candidateStatements() {
  const candidate = readFileSync(resolve(import.meta.dir,
    '../prisma/candidates/stage1-integrity/candidate.sql'), 'utf8');
  const statements = candidate.replace(/--[^\r\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean);
  if (statements.length !== 20) throw new Error('Unexpected candidate statement count.');
  const fks = statements.filter(s => /^ALTER TABLE \x60\w+\x60 ADD CONSTRAINT \x60\w+\x60 FOREIGN KEY /i.test(s));
  const indexes = statements.filter(s => /^CREATE INDEX \x60Listing_discovery_idx\x60 ON \x60Listing\x60/i.test(s));
  if (fks.length !== 19 || indexes.length !== 1 ||
    statements.some(s => /^(DROP|DELETE|UPDATE|TRUNCATE|RENAME)\b/i.test(s))) {
    throw new Error('Unexpected candidate SQL shape.');
  }
  return statements;
}

try {
  const connected = await source.$queryRawUnsafe<Row[]>('SELECT DATABASE() AS name');
  if (connected[0]?.name !== SOURCE_DB) throw new Error('Source database guard failed at query time.');
  const existing = await source.$queryRawUnsafe<Row[]>(
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', RESTORE_DB);
  if (existing.length) throw new Error('Restore sandbox already exists: refusing to overwrite it.');

  console.log('STAGE 1: baseline source snapshot (no student data printed).');
  const before = await snapshot(source);
  const dataRows = Object.values(before).reduce((sum, t)=>sum+t.count, 0);
  console.log('Source snapshot: ' + TABLES.length + ' tables; ' + dataRows + ' total rows.');

  // Dump schema + data + routines/triggers/events. The single-transaction
  // option gives a consistent InnoDB data snapshot; concurrent DDL is still unsafe.
  const writeFd = openSync(dumpFile, 'wx', 0o600);
  try {
    runCommand(DUMP_EXE, [...common, '--single-transaction', '--quick', '--hex-blob',
      '--skip-add-drop-table', '--default-character-set=utf8mb4',
      '--routines', '--triggers', '--events', SOURCE_DB], undefined, writeFd);
  } finally {
    closeSync(writeFd);
  }
  const sql = readFileSync(dumpFile, 'utf8');
  validateSQL(sql);
  if (!sql.includes('CREATE TABLE') || !sql.includes('INSERT INTO')) {
    throw new Error('Dump does not contain expected schema and data.');
  }
  const bytes = statSync(dumpFile).size;
  const digest = createHash('sha256').update(sql).digest('hex');
  console.log('Temporary SQL dump verified: ' + bytes + ' bytes, SHA-256 ' + digest.slice(0, 16) + '…');

  // Because development might be live, stop if source changed while dumping.
  const afterDump = await snapshot(source);
  if (JSON.stringify(before) !== JSON.stringify(afterDump)) {
    throw new Error('Source data changed during dump; refusing to claim snapshot integrity.');
  }

  await source.$executeRawUnsafe('CREATE DATABASE ' + q(RESTORE_DB) +
    ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  createdRestoreDatabase = true;
  // Import the full schema and data into RESTORE_DB only. Connection database
  // is explicit and the dump was checked for USE/CREATE DATABASE/DROP TABLE.
  const readFd = openSync(dumpFile, 'r');
  try {
    runCommand(MYSQL_EXE, [...common, '--default-character-set=utf8mb4', '--database=' + RESTORE_DB],
      readFd);
  } finally {
    closeSync(readFd);
  }
  restore = new PrismaClient({ datasources: { db: { url: restoreURL.toString() } } });
  const selected = await restore.$queryRawUnsafe<Row[]>('SELECT DATABASE() AS name');
  if (selected[0]?.name !== RESTORE_DB) throw new Error('Restore connection points at wrong schema!');

  const restored = await snapshot(restore);
  for (const table of TABLES) {
    if (before[table].count !== restored[table].count ||
        before[table].digest !== restored[table].digest) {
      throw new Error('Restored data mismatch for table: ' + table);
    }
  }
  console.log('RESTORE PASS: ' + TABLES.length + ' table row counts and SHA-256 content digests match.');

  const statements = candidateStatements();
  for (const statement of statements) {
    await restore.$executeRawUnsafe(statement);
  }
  console.log('CANDIDATE PASS: 19 new foreign keys and 1 index applied to restored development data.');

  const migrated = await snapshot(restore);
  if (JSON.stringify(restored) !== JSON.stringify(migrated)) {
    throw new Error('Migration changed restored table contents.');
  }
  const keys = await restore.$queryRawUnsafe<Row[]>(
    'SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE ' +
    'WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL');
  const newKeys = keys.filter(k =>
    statements.some(s => s.includes('ADD CONSTRAINT ' + q(String(k.CONSTRAINT_NAME)))));
  if (newKeys.length !== 19) throw new Error('Expected 19 new foreign keys; found ' + newKeys.length);
  const indices = await restore.$queryRawUnsafe<Row[]>(
    "SELECT COLUMN_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() " +
    "AND TABLE_NAME = 'Listing' AND INDEX_NAME = 'Listing_discovery_idx' ORDER BY SEQ_IN_INDEX");
  if (indices.map(r=>r.COLUMN_NAME).join(',') !== 'status,categoryId,campusId,createdAt') {
    throw new Error('Discovery index failed verification.');
  }
  console.log('MIGRATION VERIFICATION PASS: all restored rows preserved; 19 FKs and index present.');
  console.log('This is a local restore/migration rehearsal; production deployment not approved.');
} catch (error) {
  hasFailure = true;
  console.error('STAGE 1 REHEARSAL FAILED: ' +
    (error instanceof Error ? error.message : 'Unexpected error'));
} finally {
  if (restore) await restore.$disconnect();
  if (createdRestoreDatabase) {
    try {
      await source.$executeRawUnsafe('DROP DATABASE ' + q(RESTORE_DB));
      console.log('CLEANUP: only the temporary restore schema was removed.');
    } catch {
      console.error('CLEANUP WARNING: temporary restore schema remains, clear manually after review.');
      hasFailure = true;
    }
  }
  await source.$disconnect();
  rmSync(scratchDir, { recursive: true, force: true });
  console.log('CLEANUP: temporary local SQL dump deleted.');
}
if (hasFailure) process.exitCode = 1;
