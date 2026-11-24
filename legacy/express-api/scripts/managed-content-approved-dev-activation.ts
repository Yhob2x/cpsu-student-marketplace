/**
 * Activate ONLY the two CPSU managed guidelines/announcements migrations in
 * the local development database after a retained backup and isolated restore.
 * Run from apps/api: bun scripts/managed-content-approved-dev-activation.ts --apply-content-only
 * Never run prisma migrate dev/deploy here: the student identity migration is gated.
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, relative, resolve } from 'node:path';

const SOURCE = 'cpsu_marketplace';
const SCRATCH_PREFIX = 'cpsu_content_isolated_';
const MIGRATIONS = [
  { name: '20261116220000_managed_student_content', sha: '4d02db939aec4ce4b4a15e9938ff93d2b3ecb54ba50a137b03a94e1c8329af5f', statements: 2 },
  { name: '20261116221000_pending_announcement_edits', sha: '151eb0b58209d48985b7b713f6bd7a84c13059867009525406c2ee1995e53907', statements: 1 },
] as const;
const UNRELATED = '20261117230000_private_student_identity';
const MYSQLDUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const requireSafe = (ok: unknown, reason: string): asserts ok => { if (!ok) throw new Error('REFUSED: ' + reason); };
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const quote = (name: string) => {
  requireSafe(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'unsafe database identifier');
  return '`' + name + '`';
};
const serial = (value: unknown) => JSON.stringify(value, (_key, item) =>
  typeof item === 'bigint' ? item.toString() : item instanceof Uint8Array ? Array.from(item) : item);

requireSafe(process.argv.length === 3 && process.argv[2] === '--apply-content-only' &&
  process.env.NODE_ENV !== 'production', 'local-only explicit flag and non-production environment required');
const rawUrl = process.env.DATABASE_URL;
requireSafe(rawUrl, 'database URL missing');
const sourceUrl = new URL(rawUrl);
requireSafe(sourceUrl.protocol === 'mysql:' && sourceUrl.hostname === '127.0.0.1' &&
  (!sourceUrl.port || sourceUrl.port === '3306') &&
  decodeURIComponent(sourceUrl.pathname.slice(1)) === SOURCE,
  'only local 127.0.0.1:3306/cpsu_marketplace is allowed');
requireSafe(existsSync(MYSQL) && existsSync(MYSQLDUMP), 'XAMPP MySQL tools missing');

const candidate = MIGRATIONS.map(m => {
  const bytes = readFileSync(resolve(import.meta.dir, '../prisma/migrations', m.name, 'migration.sql'));
  requireSafe(sha(bytes) === m.sha, 'migration SQL checksum changed: ' + m.name);
  const sql = bytes.toString('utf8').trim();
  requireSafe(!/(?:^|;)\s*(?:DROP|DELETE|UPDATE|TRUNCATE|RENAME|INSERT)\s/mi.test(sql),
    'nonadditive SQL statement');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  requireSafe(statements.length === m.statements, 'unexpected SQL statement count');
  if (m.name === MIGRATIONS[0].name) {
    requireSafe(statements[0].startsWith('CREATE TABLE `GuidelineContent` (') &&
      statements[1].startsWith('CREATE TABLE `Announcement` ('),
      'unexpected managed-content create statements');
  } else {
    requireSafe(statements[0].startsWith('ALTER TABLE `Announcement`') &&
      statements[0].includes('ADD COLUMN `pendingTitle`') &&
      statements[0].includes('ADD COLUMN `pendingBody`'),
      'unexpected pending-edit alteration');
  }
  return { ...m, statements };
});
const scratchName = SCRATCH_PREFIX + randomBytes(6).toString('hex');
const scratchUrl = new URL(sourceUrl.toString());
scratchUrl.pathname = '/' + scratchName;
const backupRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'CPSU-Marketplace', 'backups');
const backupDir = join(backupRoot, 'managed-content-dev-' +
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
const dumpFile = join(backupDir, 'pre-activation.sql');

const source = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
let scratch: PrismaClient | undefined;
let scratchCreated = false;
let appliedStatements = 0;
let ledgerRecords = 0;
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
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>('SELECT * FROM ' + quote(name));
    result[name] = { count: rows.length, digest: sha(JSON.stringify(rows.map(serial).sort())) };
  }
  return result;
}
async function ledger(db: PrismaClient) {
  return db.$queryRawUnsafe<Ledger[]>(
    'SELECT migration_name,checksum,finished_at,rolled_back_at FROM `_prisma_migrations` ORDER BY migration_name');
}
function verifyPending(rows: Ledger[]) {
  requireSafe(rows.every(row => row.finished_at && !row.rolled_back_at), 'failed or incomplete migration ledger');
  requireSafe(!rows.some(row => candidate.some(m => m.name === row.migration_name) ||
    row.migration_name === UNRELATED), 'target/identity migration not in expected pending state');
  requireSafe(rows.some(row => row.migration_name === '20261118120000_managed_home_page_content' &&
    row.finished_at), 'homepage migration must remain activated');
}
function mediaHashes(dir: string) {
  const result: Record<string, string> = {};
  if (!existsSync(dir)) return result;
  const visit = (folder: string) => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      requireSafe(!entry.isSymbolicLink(), 'upload folder contains a symlink');
      const file = join(folder, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) result[relative(dir, file).replaceAll('\\', '/')] = sha(readFileSync(file));
      else throw new Error('REFUSED: unsupported upload file type');
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
  requireSafe(!result.error && result.status === 0, 'MySQL backup or restore command failed (private output withheld)');
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
    'database backup is incomplete or destructive');
  const digest = sha(bytes);
  requireSafe(sha(readFileSync(dumpFile)) === digest, 'backup checksum changed');
  const uploads = resolve(process.env.UPLOAD_DIR || './uploads');
  const before = mediaHashes(uploads);
  if (existsSync(uploads)) cpSync(uploads, join(backupDir, 'uploads'), { recursive: true, force: false });
  const after = mediaHashes(join(backupDir, 'uploads'));
  requireSafe(same(before, after), 'media backup verification failed');
  writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify({
    database: SOURCE, migrationNames: candidate.map(m => m.name),
    migrationChecksums: candidate.map(m => m.sha), sqlBytes: statSync(dumpFile).size,
    sqlSha256: digest, uploadFiles: Object.keys(after).length, createdAt: new Date().toISOString(),
  }, null, 2), { flag: 'wx', mode: 0o600 });
  backupReady = true;
  return common;
}
async function validateContentTables(db: PrismaClient, oldNames: string[]) {
  const names = await tableNames(db);
  requireSafe(names.length === oldNames.length + 2 &&
    oldNames.every(name => names.includes(name)) &&
    ['GuidelineContent', 'Announcement'].every(name => names.some(actual => actual.toLowerCase() === name.toLowerCase())),
    'unexpected schema changes');
  for (const [table, expected] of [
    ['GuidelineContent', ['id','draftBody','publishedBody','updatedAt','publishedAt']],
    ['Announcement', ['id','title','body','status','createdAt','updatedAt','publishedAt','pendingTitle','pendingBody']],
  ] as const) {
    const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(
      'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(?) ORDER BY ORDINAL_POSITION', table);
    requireSafe(same(columns.map(column => column.name), expected), 'column inventory mismatch: ' + table);
  }
  const untouchedIdentity = names.find(name => name.toLowerCase() === 'studentidentity');
  requireSafe(!untouchedIdentity, 'student identity migration must remain unapplied');
}
function recordMigration(name: string) {
  const result = spawnSync(process.execPath, ['x','prisma','migrate','resolve','--applied',name], {
    cwd: resolve(import.meta.dir, '..'), env: { ...process.env, DATABASE_URL: sourceUrl.toString() },
    windowsHide: true, stdio: ['ignore','pipe','pipe'], encoding: 'utf8', timeout: 120000,
  });
  requireSafe(!result.error && result.status === 0, 'Prisma migration ledger recording failed; inspect before retry');
}
async function applySql(db: PrismaClient, statements: readonly string[]) {
  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
    if (db === source) appliedStatements += 1;
  }
}
try {
  console.log('MANAGED_CONTENT_LOCAL_ACTIVATION_PREFLIGHT');
  await identify(source, SOURCE);
  const oldNames = await tableNames(source);
  const has = (table: string) => oldNames.some(name => name.toLowerCase() === table.toLowerCase());
  requireSafe(has('_prisma_migrations') && has('User') && has('HomePageContent') &&
    !has('GuidelineContent') && !has('Announcement') && !has('StudentIdentity'),
    'source schema inventory unexpected');
  const beforeLedger = await ledger(source);
  verifyPending(beforeLedger);
  const beforeRows = await snapshot(source, oldNames);
  const common = backup();
  requireSafe(same(beforeRows, await snapshot(source, oldNames)) &&
    same(beforeLedger, await ledger(source)), 'source changed during backup');
  console.log(JSON.stringify({phase: 'retainedBackup', result:'PASS', directory:backupDir,
    oldTables:oldNames.length, uploadsPreserved:true}));
  const existingScratch = await source.$queryRawUnsafe<Array<{ name: string }>>(
    'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', scratchName);
  requireSafe(existingScratch.length === 0 && scratchName.startsWith(SCRATCH_PREFIX), 'unsafe scratch database name');
  await source.$executeRawUnsafe('CREATE DATABASE ' + quote(scratchName) +
    ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  scratchCreated = true;
  const input = openSync(dumpFile, 'r');
  try { runCli(MYSQL, [...common, '--default-character-set=utf8mb4','--database=' + scratchName], input); }
  finally { closeSync(input); }
  scratch = new PrismaClient({ datasources: { db: {url: scratchUrl.toString()} } });
  await identify(scratch, scratchName);
  requireSafe(same(oldNames, await tableNames(scratch)) &&
    same(beforeRows, await snapshot(scratch, oldNames)), 'disposable restore differs from retained backup');
  for (const m of candidate) await applySql(scratch, m.statements);
  await validateContentTables(scratch, oldNames);
  requireSafe(same(beforeRows, await snapshot(scratch, oldNames)), 'rehearsal modified existing records');
  console.log(JSON.stringify({phase:'isolatedRestoreAndMigrations',result:'PASS',
    newTables:['GuidelineContent','Announcement'],otherRowsUnchanged:true}));
  await identify(source, SOURCE);
  requireSafe(same(oldNames, await tableNames(source)) &&
    same(beforeRows, await snapshot(source, oldNames)) &&
    same(beforeLedger, await ledger(source)), 'source changed before activation');
  for (const m of candidate) {
    await applySql(source, m.statements);
    recordMigration(m.name);
    ledgerRecords += 1;
  }
  await validateContentTables(source, oldNames);
  const afterLedger = await ledger(source);
  requireSafe(same(afterLedger.filter(row => !candidate.some(m => m.name === row.migration_name)), beforeLedger),
    'unrelated migration ledger altered');
  for (const m of candidate) {
    const row = afterLedger.find(row => row.migration_name === m.name);
    requireSafe(row?.finished_at && !row.rolled_back_at && row.checksum === m.sha, 'migration ledger checksum mismatch');
  }
  const afterRows = await snapshot(source, oldNames);
  for (const name of oldNames) if (name !== '_prisma_migrations')
    requireSafe(same(afterRows[name], beforeRows[name]), 'existing application records changed');
  console.log(JSON.stringify({phase:'developmentActivation',result:'PASS',
    migrations:candidate.map(m => m.name),identityMigrationUntouched:true,
    homepageRecordsPreserved:true,oldApplicationRecordsPreserved:true,backupRetained:true}));
} catch (error) {
  failed = true;
  console.error('MANAGED_CONTENT_ACTIVATION_FAILED: ' + (error instanceof Error ? error.message : 'unknown'));
  console.error(JSON.stringify({appliedStatements,ledgerRecords,backupReady,
    action:'inspect partial state and do not blindly retry'}));
} finally {
  if (scratch) await scratch.$disconnect();
  if (scratchCreated) {
    try {
      requireSafe(scratchName.startsWith(SCRATCH_PREFIX), 'unsafe scratch cleanup');
      await identify(source, SOURCE);
      await source.$executeRawUnsafe('DROP DATABASE ' + quote(scratchName));
      console.log('ISOLATED_CLEANUP: disposable restored database removed');
    } catch {
      failed = true;
      console.error('ISOLATED_CLEANUP_BLOCKED: inspect disposable database');
    }
  }
  await source.$disconnect();
  if (failed) process.exitCode = 1;
}
