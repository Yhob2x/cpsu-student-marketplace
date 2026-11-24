/**
 * Owner-authorized local HomePageContent activation. Backs up development,
 * rehearses on a restored disposable schema, then applies only this table.
 * Run from apps/api: bun scripts/home-page-approved-dev-activation.ts --apply-home-page-only
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, relative, resolve } from 'node:path';

const NAME = '20261118120000_managed_home_page_content';
const TABLE = 'HomePageContent';
const SOURCE = 'cpsu_marketplace';
const SCRATCH_PREFIX = 'cpsu_home_isolated_';
const EXPECTED_SHA = 'bfe9c06ec22662c91c8dbdc9d0472ba30e1cd9bf0330a1f16f63d484a7decb99';
const UNRELATED = [
  '20261116220000_managed_student_content',
  '20261116221000_pending_announcement_edits',
  '20261117230000_private_student_identity',
];
const MYSQLDUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const migrationFile = resolve(import.meta.dir, '../prisma/migrations', NAME, 'migration.sql');
const requireSafe = (condition: unknown, reason: string): asserts condition => {
  if (!condition) throw new Error('REFUSED: ' + reason);
};
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const quote = (name: string) => {
  requireSafe(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name), 'unsafe SQL identifier');
  return '`' + name + '`';
};
const serial = (value: unknown) => JSON.stringify(value, (_key, item) =>
  typeof item === 'bigint' ? item.toString() : item instanceof Uint8Array ? Array.from(item) : item);

requireSafe(process.argv.length === 3 && process.argv[2] === '--apply-home-page-only' &&
  process.env.NODE_ENV !== 'production', 'explicit local-only flag and nonproduction environment required');
const rawUrl = process.env.DATABASE_URL;
requireSafe(rawUrl, 'DATABASE_URL missing');
const sourceUrl = new URL(rawUrl);
requireSafe(sourceUrl.protocol === 'mysql:' && sourceUrl.hostname === '127.0.0.1' &&
  (!sourceUrl.port || sourceUrl.port === '3306') &&
  decodeURIComponent(sourceUrl.pathname.slice(1)) === SOURCE,
  'only local 127.0.0.1:3306/cpsu_marketplace is allowed');
requireSafe(existsSync(MYSQLDUMP) && existsSync(MYSQL), 'XAMPP MariaDB tools missing');
const migrationBytes = readFileSync(migrationFile);
requireSafe(sha(migrationBytes) === EXPECTED_SHA, 'migration SQL checksum changed');
const sql = migrationBytes.toString('utf8').trim();
requireSafe(sql.startsWith('CREATE TABLE `HomePageContent` (') &&
  sql.endsWith(') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;') &&
  (sql.match(/CREATE TABLE/g) ?? []).length === 1 &&
  !/(?:^|;)\s*(?:DROP|ALTER|DELETE|UPDATE)\s/i.test(sql),
  'migration is not the reviewed additive table');

const scratchName = SCRATCH_PREFIX + randomBytes(6).toString('hex');
const scratchUrl = new URL(sourceUrl.toString());
scratchUrl.pathname = '/' + scratchName;
const backupRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
  'CPSU-Marketplace', 'backups');
const backupDir = join(backupRoot, 'home-page-dev-' +
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
const dumpFile = join(backupDir, 'pre-activation.sql');
const source = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
let scratch: PrismaClient | undefined;
let scratchCreated = false;
let sqlApplied = false;
let ledgerRecorded = false;
let backupReady = false;
let failed = false;
type Ledger = { migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null };

async function identify(db: PrismaClient, expected: string) {
  const result = await db.$queryRawUnsafe<Array<{ name: string }>>('SELECT DATABASE() AS name');
  requireSafe(result[0]?.name === expected, 'database identity mismatch');
}
async function tableNames(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  rows.forEach(row => quote(row.name));
  return rows.map(row => row.name);
}
async function snapshot(db: PrismaClient, names: string[]) {
  const result: Record<string, { count: number; digest: string }> = {};
  for (const name of names) {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      'SELECT * FROM ' + quote(name));
    result[name] = { count: rows.length, digest: sha(JSON.stringify(rows.map(serial).sort())) };
  }
  return result;
}
async function ledger(db: PrismaClient) {
  return db.$queryRawUnsafe<Ledger[]>(
    'SELECT migration_name,checksum,finished_at,rolled_back_at FROM `_prisma_migrations` ORDER BY migration_name');
}
function verifyPending(rows: Ledger[]) {
  requireSafe(rows.every(row => row.finished_at && !row.rolled_back_at),
    'migration ledger has a failed or incomplete entry');
  requireSafe(!rows.some(row => row.migration_name === NAME || UNRELATED.includes(row.migration_name)),
    'target or unrelated pending migration already recorded');
}
function mediaHashes(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(dir)) return result;
  const visit = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      requireSafe(!entry.isSymbolicLink(), 'upload tree contains a symlink');
      const file = join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) result[relative(dir, file).replaceAll('\\', '/')] = sha(readFileSync(file));
      else throw new Error('REFUSED: unexpected upload file type');
    }
  };
  visit(dir);
  return Object.fromEntries(Object.entries(result).sort());
}
function runCli(executable: string, args: string[], input?: number, output?: number) {
  const result = spawnSync(executable, args, {
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(sourceUrl.password) },
    windowsHide: true, stdio: [input ?? 'ignore', output ?? 'ignore', 'pipe'],
    encoding: 'utf8', timeout: 180000,
  });
  requireSafe(!result.error && result.status === 0,
    'MySQL backup or restore command failed; private CLI output withheld');
}
function backup() {
  mkdirSync(backupDir, { recursive: false, mode: 0o700 });
  const acl = spawnSync('icacls.exe', [backupDir, '/inheritance:r', '/grant:r',
    userInfo().username + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'],
  { windowsHide: true, stdio: 'pipe', encoding: 'utf8' });
  requireSafe(!acl.error && acl.status === 0, 'private backup ACL could not be applied');
  const common = ['--protocol=TCP', '--host=127.0.0.1', '--port=3306',
    '--user=' + decodeURIComponent(sourceUrl.username)];
  const out = openSync(dumpFile, 'wx', 0o600);
  try {
    runCli(MYSQLDUMP, [...common, '--single-transaction', '--quick', '--hex-blob',
      '--skip-add-drop-table', '--no-tablespaces', '--default-character-set=utf8mb4',
      '--routines', '--triggers', '--events', SOURCE], undefined, out);
  } finally { closeSync(out); }
  const bytes = readFileSync(dumpFile);
  requireSafe(bytes.length > 1000 && bytes.toString('utf8').includes('CREATE TABLE') &&
    !/(?:^|\n)\s*(?:USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(bytes.toString('utf8')),
    'SQL backup is incomplete or contains unexpected destructive statements');
  const digest = sha(bytes);
  requireSafe(sha(readFileSync(dumpFile)) === digest, 'backup checksum changed');
  const uploads = resolve(process.env.UPLOAD_DIR || './uploads');
  const before = mediaHashes(uploads);
  if (existsSync(uploads)) cpSync(uploads, join(backupDir, 'uploads'), { recursive: true, force: false });
  const after = mediaHashes(join(backupDir, 'uploads'));
  requireSafe(same(before, after), 'upload backup differs from source');
  const manifest = { createdAt: new Date().toISOString(), database: SOURCE, migration: NAME,
    migrationSha256: EXPECTED_SHA, sqlBytes: statSync(dumpFile).size,
    sqlSha256: digest, uploadFiles: Object.keys(after).length };
  writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2),
    { flag: 'wx', mode: 0o600 });
  backupReady = true;
  return { manifest, common };
}
async function validateNewTable(db: PrismaClient, oldNames: string[]) {
  const names = await tableNames(db);
  requireSafe(names.length === oldNames.length + 1 &&
    names.some(name => name.toLowerCase() === TABLE.toLowerCase()) &&
    oldNames.every(name => names.includes(name)), 'the expected table was not the only schema addition');
  const columns = await db.$queryRawUnsafe<Array<{ name: string; type: string; nullable: string }>>(
    "SELECT COLUMN_NAME AS name,DATA_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='HomePageContent' ORDER BY ORDINAL_POSITION");
  requireSafe(same(columns.map(column => column.name),
    ['id','draft','published','revision','publishedRevision','updatedAt','publishedAt']) &&
    columns.find(column => column.name === 'draft')?.type === 'longtext' &&
    columns.find(column => column.name === 'published')?.nullable === 'YES',
    'homepage content columns differ from the reviewed migration');
  const key = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='HomePageContent' AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION");
  requireSafe(same(key.map(row => row.name), ['id']), 'homepage singleton primary key missing');
}
function recordOnlyThisMigration() {
  const result = spawnSync(process.execPath,
    ['x', 'prisma', 'migrate', 'resolve', '--applied', NAME],
    { cwd: resolve(import.meta.dir, '..'),
      env: { ...process.env, DATABASE_URL: sourceUrl.toString() },
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8', timeout: 120000 });
  requireSafe(!result.error && result.status === 0,
    'Prisma could not record the migration; inspect partial state before retrying');
}

try {
  console.log('HOME_PAGE_DEV_ACTIVATION_PREFLIGHT');
  await identify(source, SOURCE);
  const oldNames = await tableNames(source);
  requireSafe(oldNames.includes('_prisma_migrations') &&
    oldNames.some(name => name.toLowerCase() === 'user') &&
    !oldNames.some(name => name.toLowerCase() === TABLE.toLowerCase()),
    'source table inventory unexpected');
  const beforeLedger = await ledger(source);
  verifyPending(beforeLedger);
  const beforeRows = await snapshot(source, oldNames);
  const { manifest, common } = backup();
  requireSafe(same(beforeRows, await snapshot(source, oldNames)) &&
    same(beforeLedger, await ledger(source)), 'source changed during backup');
  console.log(JSON.stringify({ phase: 'retainedBackup', result: 'PASS', directory: backupDir,
    sqlBytes: manifest.sqlBytes, sqlSha256: manifest.sqlSha256,
    uploadFiles: manifest.uploadFiles, oldTables: oldNames.length }));

  const existingScratch = await source.$queryRawUnsafe<Array<{ name: string }>>(
    'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', scratchName);
  requireSafe(existingScratch.length === 0 && scratchName.startsWith(SCRATCH_PREFIX),
    'disposable restore name is not safe and vacant');
  await source.$executeRawUnsafe('CREATE DATABASE ' + quote(scratchName) +
    ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  scratchCreated = true;
  const input = openSync(dumpFile, 'r');
  try { runCli(MYSQL, [...common, '--default-character-set=utf8mb4',
    '--database=' + scratchName], input); }
  finally { closeSync(input); }
  scratch = new PrismaClient({ datasources: { db: { url: scratchUrl.toString() } } });
  await identify(scratch, scratchName);
  requireSafe(same(oldNames, await tableNames(scratch)) &&
    same(beforeRows, await snapshot(scratch, oldNames)),
    'disposable restore differs from the development backup');
  await scratch.$executeRawUnsafe(sql);
  await validateNewTable(scratch, oldNames);
  requireSafe(same(beforeRows, await snapshot(scratch, oldNames)),
    'rehearsal changed preexisting records');
  console.log(JSON.stringify({ phase: 'isolatedRestoreAndMigration', result: 'PASS',
    onlyNewTable: TABLE, preexistingRowsUnchanged: true }));

  await identify(source, SOURCE);
  requireSafe(!(await tableNames(source)).some(name =>
    name.toLowerCase() === TABLE.toLowerCase()) &&
    same(beforeRows, await snapshot(source, oldNames)) &&
    same(beforeLedger, await ledger(source)),
    'development source changed before activation');
  await source.$executeRawUnsafe(sql);
  sqlApplied = true;
  await validateNewTable(source, oldNames);
  recordOnlyThisMigration();
  ledgerRecorded = true;
  const afterLedger = await ledger(source);
  const target = afterLedger.find(row => row.migration_name === NAME);
  requireSafe(target?.finished_at && !target.rolled_back_at && target.checksum === EXPECTED_SHA,
    'target migration record is incomplete or checksum differs');
  requireSafe(same(afterLedger.filter(row => row.migration_name !== NAME), beforeLedger),
    'another migration record changed');
  const afterRows = await snapshot(source, oldNames);
  for (const name of oldNames) {
    if (name !== '_prisma_migrations')
      requireSafe(same(afterRows[name], beforeRows[name]), 'preexisting application records changed');
  }
  console.log(JSON.stringify({ phase: 'developmentActivation', result: 'PASS',
    migration: NAME, otherPendingMigrationsUntouched: true,
    applicationRecordsPreserved: true, backupRetained: true }));
} catch (error) {
  failed = true;
  console.error('HOME_PAGE_DEV_ACTIVATION_FAILED: ' +
    (error instanceof Error ? error.message : 'unknown failure'));
  console.error(JSON.stringify({ sqlApplied, ledgerRecorded, backupReady,
    action: 'inspect state; do not run broad migrations or blindly retry' }));
} finally {
  if (scratch) await scratch.$disconnect();
  if (scratchCreated) {
    try {
      requireSafe(scratchName.startsWith(SCRATCH_PREFIX), 'unsafe scratch cleanup name');
      await identify(source, SOURCE);
      await source.$executeRawUnsafe('DROP DATABASE ' + quote(scratchName));
      console.log('ISOLATED_CLEANUP: disposable restored database removed');
    } catch {
      failed = true;
      console.error('ISOLATED_CLEANUP_BLOCKED: inspect the disposable restore only');
    }
  }
  await source.$disconnect();
  if (failed) process.exitCode = 1;
}
