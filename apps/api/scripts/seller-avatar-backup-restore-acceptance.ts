/**
 * CPSU seller-avatar migration: fresh protected development backup, restore to
 * a NEW disposable local schema, migrate ONLY the restore, verify unchanged
 * source rows, and perform synthetic database tests. Never writes to dev.
 * Execute explicitly: bun scripts/seller-avatar-backup-restore-acceptance.ts --isolated-acceptance
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import { publishSellerAvatar } from '../src/seller-avatar-update.js';

const SOURCE = 'cpsu_marketplace';
const SCRATCH_PREFIX = 'cpsu_avatar_isolated_';
const MYSQLDUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const EXPECTED_SQL = 'ALTER TABLE `SellerProfile`\n  ADD COLUMN `avatarPath` VARCHAR(255) NULL;';
const MIGRATION = resolve(import.meta.dir, '../prisma/migrations/20261117123000_seller_avatar_review/migration.sql');
const assert = (ok: unknown, message: string): asserts ok => {
  if (!ok) throw new Error(message);
};
const quote = (x: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(x)) throw new Error('Unexpected SQL identifier');
  return '`' + x + '`';
};
if (process.argv.length !== 3 || process.argv[2] !== '--isolated-acceptance' ||
    process.env.NODE_ENV === 'production') {
  throw new Error('REFUSED: require --isolated-acceptance outside production.');
}
const rawUrl = process.env.DATABASE_URL;
assert(rawUrl, 'REFUSED: missing DATABASE_URL');
const srcUrl = new URL(rawUrl);
assert(srcUrl.protocol === 'mysql:' && srcUrl.hostname === '127.0.0.1' &&
  (srcUrl.port === '3306' || !srcUrl.port) &&
  decodeURIComponent(srcUrl.pathname.slice(1)) === SOURCE,
  'REFUSED: expected local 127.0.0.1:3306/cpsu_marketplace');
assert(existsSync(MYSQLDUMP) && existsSync(MYSQL), 'XAMPP MySQL CLI missing.');
const sourceSql = readFileSync(MIGRATION, 'utf8');
const sql = sourceSql.split(/\r?\n/).filter(s => !/^\s*--/.test(s)).join('\n').trim();
assert(sql === EXPECTED_SQL, 'REFUSED: seller avatar SQL is not the approved one-column migration.');
const sqlHash = createHash('sha256').update(sourceSql).digest('hex');
assert(sqlHash === '9183574c569804e603371466d76d50477b0c7603ae3022bc73a8a54f2c0ac91f',
  'REFUSED: seller avatar migration hash changed since preflight.');

const scratch = SCRATCH_PREFIX + randomBytes(6).toString('hex');
const backupRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'CPSU-Marketplace', 'backups');
const backupDir = join(backupRoot, 'seller-avatar-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
const backupFile = join(backupDir, 'development-schema-data.sql');
const restoreUrl = new URL(srcUrl.toString());
restoreUrl.pathname = '/' + scratch;
const creds = { ...process.env, MYSQL_PWD: decodeURIComponent(srcUrl.password) };
const common = ['--protocol=TCP', '--host=127.0.0.1', '--port=3306',
  '--user=' + decodeURIComponent(srcUrl.username)];
const source = new PrismaClient({ datasources: { db: { url: srcUrl.toString() } } });
let restored: PrismaClient | undefined;
let created = false;
let retainedBackup = false;
let errors = 0;
type Row = Record<string, any>;
type Table = { name: string; kind: string };

function command(exe: string, args: string[], stdin?: number, stdout?: number) {
  const result = spawnSync(exe, args, {
    env: creds, stdio: [stdin ?? 'ignore', stdout ?? 'ignore', 'pipe'],
    encoding: 'utf8', windowsHide: true, timeout: 180000,
  });
  if (result.error || result.status !== 0) {
    throw new Error('MySQL CLI failed at ' + exe.split('\\').at(-1) +
      ' (exit ' + String(result.status) + '). No SQL or credentials printed.');
  }
}
function lockFolder(dir: string) {
  const user = userInfo().username;
  const result = spawnSync('icacls.exe', [dir, '/inheritance:r', '/grant:r',
    user + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], {
    stdio: 'pipe', encoding: 'utf8', windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error('REFUSED: could not lock private backup directory ACL.');
}
function rowString(row: Row) {
  return JSON.stringify(row, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v);
}
async function inspect(prisma: PrismaClient, dbName: string) {
  const names = await prisma.$queryRawUnsafe<{ db: string }[]>('SELECT DATABASE() AS db');
  assert(names[0]?.db === dbName, 'REFUSED: unexpected database identity.');
  const tables = await prisma.$queryRawUnsafe<Table[]>(`
    SELECT TABLE_NAME AS name, TABLE_TYPE AS kind FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`);
  assert(tables.some(t => t.name.toLowerCase() === 'sellerprofile') &&
    tables.some(t => t.name === '_prisma_migrations'),
    'REFUSED: core tables not found; tables=' + JSON.stringify(tables.map(t => t.name)));
  for (const t of tables) quote(t.name);
  return tables.map(t => t.name);
}
async function snapshot(prisma: PrismaClient, tables: string[], excludeAvatar = false) {
  const result: Record<string, {count: number; hash: string}> = {};
  for (const table of tables) {
    const cols = await prisma.$queryRawUnsafe<{COLUMN_NAME: string}[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", table);
    const names = cols.map(x => x.COLUMN_NAME).filter(n => !(excludeAvatar && table.toLowerCase() === 'sellerprofile' && n === 'avatarPath'));
    assert(names.length > 0, 'Table without columns.');
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      'SELECT ' + names.map(quote).join(',') + ' FROM ' + quote(table));
    const serial = rows.map(rowString).sort();
    result[table] = {count: rows.length, hash: createHash('sha256').update(JSON.stringify(serial)).digest('hex')};
  }
  return result;
}
function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

try {
  console.log('AVATAR_ISOLATED_PREFLIGHT started; no persistent source modifications.');
  const tables = await inspect(source, SOURCE);
  const exists = await source.$queryRawUnsafe<{SCHEMA_NAME:string}[]>(
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', scratch);
  assert(!exists.length, 'REFUSED: scratch schema already exists.');
  const hasAvatar = await source.$queryRawUnsafe<{COLUMN_NAME:string}[]>(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SellerProfile' AND COLUMN_NAME='avatarPath'");
  assert(hasAvatar.length === 0, 'REFUSED: avatar column already exists in source.');
  const ledger = await source.$queryRawUnsafe<{migration_name:string;finished_at:Date|null}[]>(
    "SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name='20261117123000_seller_avatar_review'");
  assert(ledger.length === 0, 'REFUSED: seller avatar migration already recorded.');
  const before = await snapshot(source, tables);

  mkdirSync(backupDir, {recursive: false});
  lockFolder(backupDir);
  const out = openSync(backupFile, 'wx', 0o600);
  try {
    command(MYSQLDUMP, [...common, '--single-transaction', '--quick', '--hex-blob',
      '--skip-add-drop-table', '--no-tablespaces', '--default-character-set=utf8mb4',
      '--routines', '--triggers', '--events', SOURCE], undefined, out);
  } finally { closeSync(out); }
  const backup = readFileSync(backupFile);
  assert(backup.length > 0, 'REFUSED: empty database backup.');
  const dumpedSql = backup.toString('utf8');
  assert(dumpedSql.includes('CREATE TABLE') &&
    !/(?:^|\n)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(dumpedSql),
    'REFUSED: backup SQL contains unapproved database switches or destructive statements.');
  const backupHash = createHash('sha256').update(backup).digest('hex');
  assert(createHash('sha256').update(readFileSync(backupFile)).digest('hex') === backupHash,
    'REFUSED: backup checksum could not be verified.');
  retainedBackup = true;
  const afterBackup = await snapshot(source, tables);
  assert(same(before, afterBackup), 'Source changed during backup; backup retained but restore claim blocked.');
  console.log(JSON.stringify({phase:'backup', result:'PASS', tableCount:tables.length,
    bytes:statSync(backupFile).size, sha256:backupHash, privateDir:backupDir}));

  await source.$executeRawUnsafe('CREATE DATABASE ' + quote(scratch) + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  created = true;
  const input = openSync(backupFile, 'r');
  try { command(MYSQL, [...common, '--default-character-set=utf8mb4', '--database=' + scratch], input); }
  finally { closeSync(input); }
  restored = new PrismaClient({ datasources: { db: {url:restoreUrl.toString()} } });
  const restoredTables = await inspect(restored, scratch);
  assert(same(tables, restoredTables), 'Restore table inventory mismatch.');
  const baselineRestore = await snapshot(restored, tables);
  assert(same(before, baselineRestore), 'Restored row counts or content checksums differ from source.');
  console.log(JSON.stringify({phase:'restore', result:'PASS', allTables:tables.length, dataUnchanged:true}));

  await restored.$executeRawUnsafe(sql);
  const cols = await restored.$queryRawUnsafe<{COLUMN_NAME:string; COLUMN_TYPE:string; IS_NULLABLE:string}[]>(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SellerProfile' AND COLUMN_NAME='avatarPath'`);
  assert(cols.length === 1 && cols[0].COLUMN_TYPE.toLowerCase() === 'varchar(255)' &&
    cols[0].IS_NULLABLE === 'YES', 'Avatar column mismatch after isolated ALTER.');
  const unchanged = await snapshot(restored, tables, true);
  assert(same(before, unchanged), 'Existing rows were modified by avatar DDL.');
  const nonNull = await restored.$queryRawUnsafe<{n: bigint}[]>(
    'SELECT COUNT(*) AS n FROM `SellerProfile` WHERE `avatarPath` IS NOT NULL');
  assert(Number(nonNull[0]?.n) === 0, 'Unexpected non-null restored avatar values.');
  console.log(JSON.stringify({phase:'isolatedMigration', result:'PASS', target:'disposable restore only',
    verifiedColumn:'avatarPath varchar(255) NULL', otherRowsPreserved:true}));

  // Only synthetic entries created here are written for the acceptance exercise.
  let campus = await restored.campus.findFirst({select:{id:true}});
  if (!campus) campus = await restored.campus.create({data:{
    code:'AVQA'+randomBytes(3).toString('hex').toUpperCase(), name:'Synthetic Avatar Test Campus',
  },select:{id:true}});
  const synthetic = await restored.user.create({data:{
    email:'avatar-acceptance-'+randomBytes(8).toString('hex')+'@example.invalid',
    displayName:'Synthetic Seller Acceptance', passwordHash:'disabled-synthetic-auth',
  },select:{id:true}});
  const store = await restored.sellerProfile.create({data:{
    ownerUserId:synthetic.id, campusId:campus.id, storeName:'Synthetic Store Avatar',
    description:'Isolated and temporary test-only store.', approvalStatus:'approved',
  }, select:{id:true}});
  const first = await publishSellerAvatar(restored, synthetic.id, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp');
  assert(first.id === store.id && first.previousPath === null, 'First synthetic publication failed.');
  const second = await publishSellerAvatar(restored, synthetic.id, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp');
  assert(second.previousPath === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp',
    'Synthetic replacement did not preserve the previous reference.');
  let blockedOther = false;
  try { await publishSellerAvatar(restored, synthetic.id+1234567, 'cccccccccccccccccccccccccccccccc.webp'); }
  catch { blockedOther = true; }
  assert(blockedOther, 'Ownership verification did not block a different user.');
  const updated = await restored.sellerProfile.findUnique({
    where:{id:store.id}, select:{avatarPath:true},
  });
  assert(updated?.avatarPath === 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp',
    'Unexpected synthetic public avatar reference.');
  const audit = await restored.auditLog.count({
    where:{actorUserId:synthetic.id, action:'seller.avatar_published', targetId:store.id},
  });
  assert(audit === 2, 'Synthetic public avatar changes were not audited.');
  console.log(JSON.stringify({phase:'syntheticDbAcceptance',result:'PASS',
    firstUpload:true,replacement:true,otherSellerDenied:true,transactionalAudit:true}));

  const afterSource = await snapshot(source, tables);
  assert(same(before, afterSource), 'Source changed while running isolated acceptance.');
  console.log(JSON.stringify({phase:'developmentReadOnlyPostcheck',result:'PASS',dataUnchanged:true}));
  console.log(JSON.stringify({phase:'overall',result:'PASS',
    developmentMigrationApplied:false,backupRetained:true}));
} catch (error) {
  errors++;
  console.error('AVATAR_ISOLATED_ACCEPTANCE_FAILED: ' +
    (error instanceof Error ? error.message : 'unexpected failure'));
  console.error('No direct application to development database was attempted.');
} finally {
  if (restored) await restored.$disconnect();
  if (created) {
    try {
      const exists = await source.$queryRawUnsafe<{SCHEMA_NAME:string}[]>(
        'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', scratch);
      if (exists.length) {
        await source.$executeRawUnsafe('DROP DATABASE ' + quote(scratch));
        console.log('CLEANUP: only the unique disposable restore schema was deleted.');
      }
    } catch {
      errors++;
      console.error('CLEANUP_BLOCKED: isolated restore may remain; review before manual removal.');
    }
  }
  await source.$disconnect();
  console.log(JSON.stringify({retainedBackup,developmentSchemaModified:false,errorCount:errors}));
  if(errors) process.exitCode = 1;
}
