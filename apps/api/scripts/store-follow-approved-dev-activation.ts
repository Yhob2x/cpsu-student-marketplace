/**
 * CPSU Market -- OWNER-APPROVED LOCAL StoreFollow-only activation.
 * Never run prisma migrate dev/deploy. Never apply older pending migrations.
 * Usage: bun scripts/store-follow-approved-dev-activation.ts --apply-approved-store-follow-only
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, relative, resolve } from 'node:path';

const NAME = '20261117180000_store_follows';
const UNRELATED = ['20261116220000_managed_student_content',
  '20261116221000_pending_announcement_edits'];
const SOURCE = 'cpsu_marketplace';
const DUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const SQL_PATH = resolve(import.meta.dir, '../prisma/migrations', NAME, 'migration.sql');
const EXPECTED_HASH = '292d3510e8ad2971fcd250ced7d8be2de9d4a2bc785b0d4b70d6a4cf19ddcae1';
const bail = (ok: unknown, why: string): asserts ok => {
  if (!ok) throw new Error('REFUSED: ' + why);
};
const quote = (id: string) => { bail(/^[a-zA-Z0-9_]+$/.test(id), 'unsafe SQL identifier'); return '`' + id + '`'; };
const sha = (x: Buffer | string) => createHash('sha256').update(x).digest('hex');
const serial = (x: unknown) => JSON.stringify(x, (_, v) =>
  typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
bail(process.argv.length === 3 && process.argv[2] === '--apply-approved-store-follow-only' &&
  process.env.NODE_ENV !== 'production', 'explicit approved-only flag and nonproduction environment required');
const databaseUrl = process.env.DATABASE_URL;
bail(databaseUrl, 'missing DATABASE_URL');
const url = new URL(databaseUrl);
bail(url.protocol === 'mysql:' && url.hostname === '127.0.0.1' &&
  (!url.port || url.port === '3306') && decodeURIComponent(url.pathname.slice(1)) === SOURCE,
  'only local 127.0.0.1:3306/cpsu_marketplace is authorized');
bail(existsSync(DUMP), 'XAMPP mysqldump missing');
const sqlText = readFileSync(SQL_PATH, 'utf8');
bail(sha(sqlText) === EXPECTED_HASH, 'StoreFollow migration SHA-256 changed');
const sql = sqlText.replace(/\r/g, '').split('\n').filter(line => !/^\s*--/.test(line)).join('\n').trim();
bail(sql.startsWith('CREATE TABLE `StoreFollow` (\n') &&
  sql.endsWith(') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;') &&
  (sql.match(/CREATE TABLE/g) || []).length === 1 &&
  !/(?:^|;)\s*(?:DROP|ALTER|DELETE|UPDATE)\s/i.test(sql), 'migration content is not a single additive CREATE TABLE');
const db = new PrismaClient({datasources: {db: {url: url.toString()}}});
const backupRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
  'CPSU-Marketplace', 'backups');
const dir = join(backupRoot, 'store-follow-dev-approval-' +
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
const backup = join(dir, 'pre-activation.sql');
const migrationNames = [NAME, ...UNRELATED];
let didApplySql = false, ledgerRecorded = false, backupReady = false;
let failed = false;
type Row = Record<string, unknown>;
type Ledger = {migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null};
async function identify() {
  const r = await db.$queryRawUnsafe<Array<{ name: string }>>('SELECT DATABASE() AS name');
  bail(r[0]?.name === SOURCE, 'unexpected connected database');
}
async function tables() {
  const r = await db.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const names = r.map(x => x.name);
  bail(names.some(x => x.toLowerCase() === 'sellerprofile') &&
    names.some(x => x.toLowerCase() === 'user') && names.includes('_prisma_migrations'),
    'existing source schema missing expected tables');
  names.forEach(quote);
  return names;
}
async function snapshot(names: string[]) {
  const result: Record<string, {count:number; digest:string}> = {};
  for (const name of names) {
    const rows = await db.$queryRawUnsafe<Row[]>('SELECT * FROM ' + quote(name));
    result[name] = {count:rows.length, digest:sha(JSON.stringify(rows.map(serial).sort()))};
  }
  return result;
}
async function ledger() {
  return db.$queryRawUnsafe<Ledger[]>(
    'SELECT migration_name,checksum,finished_at,rolled_back_at FROM `_prisma_migrations` ORDER BY migration_name');
}
function relevantLedger(rows: Ledger[]) {
  return rows.filter(x => migrationNames.includes(x.migration_name));
}
function verifyBefore(rows: Ledger[]) {
  const names = relevantLedger(rows);
  bail(!names.some(x => x.migration_name === NAME), 'StoreFollow already present in migration history');
  bail(!names.some(x => UNRELATED.includes(x.migration_name)),
    'one of the two unrelated migrations was applied, or is in a failed state');
  bail(rows.every(x => !!x.finished_at && !x.rolled_back_at), 'source has failed/incomplete migration state');
}
async function validateFollowTable() {
  const exists = (await tables()).some(x => x.toLowerCase() === 'storefollow');
  bail(exists, 'new StoreFollow table missing');
  const cols = await db.$queryRawUnsafe<Array<{ columnName:string; nullable:string }>>(
    "SELECT COLUMN_NAME AS columnName,IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow' ORDER BY ORDINAL_POSITION");
  bail(eq(cols.map(x => x.columnName), ['userId','sellerProfileId','createdAt']) &&
    cols.every(x => x.nullable === 'NO'), 'follow columns are not exact shape');
  const pk = await db.$queryRawUnsafe<Array<{columnName:string}>>(
    "SELECT COLUMN_NAME AS columnName FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow' AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION");
  bail(eq(pk.map(x => x.columnName), ['userId','sellerProfileId']), 'follow composite PK invalid');
  const fks = await db.$queryRawUnsafe<Array<{target:string; deleteRule:string}>>(
    "SELECT k.REFERENCED_TABLE_NAME AS target, r.DELETE_RULE AS deleteRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='StoreFollow' AND k.REFERENCED_TABLE_NAME IS NOT NULL");
  bail(fks.length === 2 && fks.every(x => x.deleteRule === 'RESTRICT') &&
    fks.some(x => x.target?.toLowerCase() === 'user') &&
    fks.some(x => x.target?.toLowerCase() === 'sellerprofile'), 'follow foreign keys not approved');
  const ix = await db.$queryRawUnsafe<Array<{col:string}>>(
    "SELECT COLUMN_NAME AS col FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow' AND INDEX_NAME='StoreFollow_sellerProfileId_createdAt_idx' ORDER BY SEQ_IN_INDEX");
  bail(eq(ix.map(x => x.col), ['sellerProfileId','createdAt']), 'follow index does not match migration');
  const count = await db.$queryRawUnsafe<Array<{n:bigint}>>('SELECT COUNT(*) AS n FROM `StoreFollow`');
  bail(Number(count[0]?.n) === 0, 'new StoreFollow table unexpectedly contains records');
}
function lockDir(path: string) {
  mkdirSync(path, { recursive: false, mode: 0o700 });
  const proc = spawnSync('icacls.exe',
    [path, '/inheritance:r', '/grant:r', userInfo().username+':(OI)(CI)F',
      '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'],
    {stdio:'pipe', encoding:'utf8', windowsHide:true});
  bail(!proc.error && proc.status === 0, 'cannot protect private backup directory');
}
function hashes(folder: string) {
  const output:Record<string,string> = {};
  if (!existsSync(folder)) return output;
  const walk = (path:string) => {
    for (const item of readdirSync(path,{withFileTypes:true})) {
      bail(!item.isSymbolicLink(), 'symlink found in upload tree');
      const full = join(path,item.name);
      if (item.isDirectory()) walk(full);
      else if (item.isFile()) output[relative(folder, full).replaceAll('\\','/')] = sha(readFileSync(full));
      else throw new Error('Unexpected upload file type');
    }
  }; walk(folder);
  return Object.fromEntries(Object.entries(output).sort());
}
function runBackup() {
  lockDir(dir);
  const out = openSync(backup,'wx',0o600);
  try {
    const child = spawnSync(DUMP,
      ['--protocol=TCP','--host=127.0.0.1','--port=3306',
       '--user='+decodeURIComponent(url.username),'--single-transaction','--quick','--hex-blob',
       '--skip-add-drop-table','--no-tablespaces','--default-character-set=utf8mb4',
       '--routines','--triggers','--events',SOURCE],
      { env: {...process.env, MYSQL_PWD:decodeURIComponent(url.password)},
        windowsHide:true,stdio:['ignore',out,'pipe'],encoding:'utf8',timeout:180000 });
    bail(!child.error && child.status === 0, 'mysqldump failed');
  } finally { closeSync(out); }
  const bytes = readFileSync(backup);
  bail(bytes.length > 1000 && bytes.toString('utf8').includes('CREATE TABLE') &&
    !/(?:^|\n)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(bytes.toString('utf8')),
    'backup appears incomplete or contains unexpected destructive SQL');
  const digest = sha(bytes);
  bail(sha(readFileSync(backup)) === digest, 'fresh backup checksum failed');
  const sourceUploads = resolve(process.env.UPLOAD_DIR ?? './uploads');
  const sourceHashes = hashes(sourceUploads);
  if (existsSync(sourceUploads))
    cpSync(sourceUploads,join(dir,'uploads'),{recursive:true,force:false});
  const copyHashes = hashes(join(dir,'uploads'));
  bail(eq(sourceHashes,copyHashes), 'upload file backup digest mismatch');
  const manifest = {createdAt:new Date().toISOString(),database:SOURCE,migration:NAME,
    migrationSha256:EXPECTED_HASH,bytes:statSync(backup).size,sha256:digest,
    uploads:Object.keys(copyHashes).length, localOnly:true};
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  backupReady = true;
  return manifest;
}
function resolveExactlyThisMigration() {
  // Mark ONLY the SQL already applied above. No migrate dev/deploy.
  const result = spawnSync(process.execPath,
    ['x','prisma','migrate','resolve','--applied',NAME],
    {cwd:resolve(import.meta.dir,'..'), env:{...process.env,DATABASE_URL:url.toString()},
      windowsHide:true,stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:120000});
  bail(!result.error && result.status === 0, 'Prisma resolve failed; inspect partial state before any retry');
}
try {
  console.log('STORE_FOLLOW_APPROVED_DEV_ACTIVATION_PREFLIGHT');
  await identify();
  const names = await tables();
  bail(!names.some(x => x.toLowerCase() === 'storefollow'), 'StoreFollow table is already present');
  const history = await ledger();
  verifyBefore(history);
  const original = await snapshot(names);
  const manifest = runBackup();
  bail(eq(original,await snapshot(names)), 'source data changed during backup');
  bail(eq(history,await ledger()), 'migration ledger changed during backup');
  console.log(JSON.stringify({phase:'retainedPreActivationBackup',result:'PASS',backupDir:dir,
    bytes:manifest.bytes,sha256:manifest.sha256,uploads:manifest.uploads,
    tableCount:names.length,preexistingDataPreserved:true}));
  // Last source checks immediately before the one authorized DDL statement.
  await identify();
  bail(!(await tables()).some(x => x.toLowerCase()==='storefollow'), 'StoreFollow table appeared during preflight');
  verifyBefore(await ledger());
  bail(eq(original,await snapshot(names)), 'source changed; activation refused');
  console.log('APPROVED_SQL_BEGIN: StoreFollow CREATE TABLE only');
  await db.$executeRawUnsafe(sql);
  didApplySql = true;
  await validateFollowTable();
  resolveExactlyThisMigration();
  ledgerRecorded = true;
  const afterLedger = await ledger();
  const target = afterLedger.find(x => x.migration_name === NAME);
  bail(!!target && !!target.finished_at && !target.rolled_back_at && target.checksum === EXPECTED_HASH,
    'migration ledger failed checksum/finish verification');
  bail(eq(afterLedger.filter(x => x.migration_name !== NAME),history),
    'other migration records modified unexpectedly');
  bail(eq(Object.fromEntries(Object.entries(original).filter(([k])=>k!=='_prisma_migrations')),
       Object.fromEntries(Object.entries(await snapshot(names)).filter(([k])=>k!=='_prisma_migrations'))),
    'original application records were modified by activation');
  console.log(JSON.stringify({phase:'developmentSchemaActivation',result:'PASS',
    migration:NAME,onlyOneTableAdded:true,otherPendingMigrationsUntouched:true,
    sourceApplicationDataPreserved:true,backupRetained:true}));
} catch(error) {
  failed = true;
  console.error('STORE_FOLLOW_APPROVED_DEV_ACTIVATION_FAILED: ' +
    (error instanceof Error ? error.message : 'unknown error'));
  console.error(JSON.stringify({didApplySql,ledgerRecorded,backupReady,
    action:'inspect state; do not run broad migrations or blindly retry'}));
} finally {
  await db.$disconnect();
  if (failed) process.exitCode=1;
}
