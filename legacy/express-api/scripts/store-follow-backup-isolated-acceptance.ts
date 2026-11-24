/**
 * CPSU Market StoreFollow: approved BACKUP + ISOLATED MIGRATION REHEARSAL ONLY.
 * Never migrates cpsu_marketplace, never touches shared test databases.
 * Run from apps/api: bun scripts/store-follow-backup-isolated-acceptance.ts --isolated-acceptance
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, relative, resolve } from 'node:path';

const SOURCE = 'cpsu_marketplace';
const PREFIX = 'cpsu_follow_isolated_';
const MIGRATION = resolve(import.meta.dir, '../prisma/migrations/20261117180000_store_follows/migration.sql');
const MYSQLDUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const assert = (truth: unknown, message: string): asserts truth => {
  if (!truth) throw new Error('REFUSED: ' + message);
};
const quote = (name: string) => {
  assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(name), 'invalid SQL identifier');
  return '`' + name + '`';
};
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const serial = (value: unknown) => JSON.stringify(value, (_, v) =>
  typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

assert(process.argv.length === 3 && process.argv[2] === '--isolated-acceptance', 'explicit --isolated-acceptance required');
assert(process.env.NODE_ENV !== 'production', 'production execution prohibited');
const raw = process.env.DATABASE_URL;
assert(raw, 'missing DATABASE_URL');
const sourceUrl = new URL(raw);
assert(sourceUrl.protocol === 'mysql:' && sourceUrl.hostname === '127.0.0.1' &&
  (!sourceUrl.port || sourceUrl.port === '3306') &&
  decodeURIComponent(sourceUrl.pathname.slice(1)) === SOURCE,
  'expected local 127.0.0.1:3306/cpsu_marketplace');
assert(existsSync(MYSQLDUMP) && existsSync(MYSQL), 'XAMPP MariaDB command line tools missing');
const migrationText = readFileSync(MIGRATION, 'utf8');
const sql = migrationText.replace(/\r/g, '').split('\n')
  .filter(x => !/^\s*--/.test(x)).join('\n').trim();
const expected = [
  'CREATE TABLE `StoreFollow` (',
  '  `userId` INTEGER NOT NULL,',
  '  `sellerProfileId` INTEGER NOT NULL,',
  '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),',
  '  INDEX `StoreFollow_sellerProfileId_createdAt_idx`(`sellerProfileId`, `createdAt`),',
  '  PRIMARY KEY (`userId`, `sellerProfileId`),',
  '  CONSTRAINT `StoreFollow_userId_fkey`',
  '    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
  '  CONSTRAINT `StoreFollow_sellerProfileId_fkey`',
  '    FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
  ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
].join('\n');
assert(sql === expected, 'migration SQL differs from the exact reviewed StoreFollow-only DDL');
const scratch = PREFIX + randomBytes(6).toString('hex');
const backupRoot = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'CPSU-Marketplace', 'backups');
const backupDir = join(backupRoot, 'store-follow-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' +
  randomBytes(3).toString('hex'));
const dumpFile = join(backupDir, 'development-schema-data.sql');
const restoreUrl = new URL(sourceUrl.toString());
restoreUrl.pathname = '/' + scratch;
const credentials = { ...process.env, MYSQL_PWD: decodeURIComponent(sourceUrl.password) };
const commonArgs = ['--protocol=TCP', '--host=127.0.0.1', '--port=3306',
  '--user=' + decodeURIComponent(sourceUrl.username)];
const source = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
let restored: PrismaClient | undefined;
let created = false;
let retained = false;
let errors = 0;

function cli(executable: string, args: string[], stdin?: number, stdout?: number) {
  const result = spawnSync(executable, args, { env: credentials, windowsHide: true,
    stdio: [stdin ?? 'ignore', stdout ?? 'ignore', 'pipe'], encoding: 'utf8', timeout: 180000 });
  if (result.error || result.status !== 0)
    throw new Error('MySQL backup/restore CLI failed (exit ' + String(result.status) + '). No sensitive output shown.');
}
function lock(dir: string) {
  const user = userInfo().username;
  const p = spawnSync('icacls.exe', [dir, '/inheritance:r', '/grant:r',
    user + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], {
    windowsHide: true, stdio: 'pipe', encoding: 'utf8',
  });
  assert(!p.error && p.status === 0, 'private backup ACL could not be applied');
}
function photoHashes(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(dir)) return result;
  const walk = (here: string) => {
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const file = join(here, entry.name);
      assert(!entry.isSymbolicLink(), 'upload symlinks are not allowed');
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) result[relative(dir, file).replaceAll('\\', '/')] = sha(readFileSync(file));
      else throw new Error('REFUSED: unexpected upload entry type');
    }
  };
  walk(dir);
  return Object.fromEntries(Object.entries(result).sort());
}
type TableRow = Record<string, unknown>;
async function databaseIdentity(db: PrismaClient, name: string) {
  const value = await db.$queryRawUnsafe<Array<{db: string}>>('SELECT DATABASE() AS db');
  assert(value[0]?.db === name, 'connection target identity mismatch');
}
async function inventory(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<Array<{name: string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  return rows.map(x => x.name);
}
async function snapshot(db: PrismaClient, tables: string[]) {
  const result: Record<string, {count: number; hash: string}> = {};
  for (const name of tables) {
    const rows = await db.$queryRawUnsafe<TableRow[]>('SELECT * FROM ' + quote(name));
    const signatures = rows.map(serial).sort();
    result[name] = { count: rows.length, hash: sha(JSON.stringify(signatures)) };
  }
  return result;
}
async function runSynthetic(db: PrismaClient) {
  // All inserts, deletes, and negative-constraint probes target the unique SCRATCH database.
  await databaseIdentity(db, scratch);
  const campus = await db.$queryRawUnsafe<Array<{id: number}>>('SELECT id FROM `Campus` ORDER BY id LIMIT 1');
  assert(campus.length > 0, 'no campus in restored fixture; synthetic test requires an existing campus');
  const marker = randomBytes(8).toString('hex');
  const accounts = [0,1,2].map(i => 'follow-qa-' + i + '-' + marker + '@example.invalid');
  for (const mail of accounts) {
    await db.$executeRawUnsafe(
      'INSERT INTO `User` (`email`,`displayName`,`passwordHash`) VALUES (?,?,?)',
      mail, 'Follow QA Only', 'disabled-synthetic-auth');
  }
  const people = await db.$queryRawUnsafe<Array<{id: number; email: string}>>(
    'SELECT id,email FROM `User` WHERE email IN (?,?,?)', ...accounts);
  const byEmail = new Map(people.map(u => [u.email, u.id]));
  const owner = byEmail.get(accounts[0]), viewer = byEmail.get(accounts[1]), other = byEmail.get(accounts[2]);
  assert(owner && viewer && other, 'synthetic accounts not found');
  const storeName = 'Follow QA ' + marker;
  await db.$executeRawUnsafe(
    'INSERT INTO `SellerProfile` (`ownerUserId`,`campusId`,`storeName`,`description`,`approvalStatus`) VALUES (?,?,?,?,?)',
    owner, campus[0].id, storeName, 'Temporary test-only storefront', 'approved');
  const s = await db.$queryRawUnsafe<Array<{id: number}>>(
    'SELECT id FROM `SellerProfile` WHERE `ownerUserId`=? AND `storeName`=?', owner, storeName);
  assert(s.length === 1, 'synthetic store missing');
  const storeId = s[0].id;
  await db.$executeRawUnsafe(
    'INSERT INTO `StoreFollow` (`userId`,`sellerProfileId`) VALUES (?,?)', viewer, storeId);
  await db.$executeRawUnsafe(
    'INSERT INTO `StoreFollow` (`userId`,`sellerProfileId`) VALUES (?,?)', other, storeId);
  const count = await db.$queryRawUnsafe<Array<{n: bigint}>>(
    'SELECT COUNT(*) AS n FROM `StoreFollow` WHERE `sellerProfileId`=?', storeId);
  assert(Number(count[0].n) === 2, 'follower count not 2 after two follows');
  let duplicateBlocked = false, foreignKeyBlocked = false, ownerDeleteRestricted = false;
  try {
    await db.$executeRawUnsafe('INSERT INTO `StoreFollow` (`userId`,`sellerProfileId`) VALUES (?,?)', viewer, storeId);
  } catch { duplicateBlocked = true; }
  try {
    await db.$executeRawUnsafe('INSERT INTO `StoreFollow` (`userId`,`sellerProfileId`) VALUES (?,?)', viewer, storeId + 1000000000);
  } catch { foreignKeyBlocked = true; }
  try {
    await db.$executeRawUnsafe('DELETE FROM `SellerProfile` WHERE id=?', storeId);
  } catch { ownerDeleteRestricted = true; }
  assert(duplicateBlocked && foreignKeyBlocked && ownerDeleteRestricted,
    'unique key or restrict foreign-key enforcement did not work');
  await db.$executeRawUnsafe('DELETE FROM `StoreFollow` WHERE `userId`=? AND `sellerProfileId`=?', viewer, storeId);
  const left = await db.$queryRawUnsafe<Array<{n: bigint}>>(
    'SELECT COUNT(*) AS n FROM `StoreFollow` WHERE `sellerProfileId`=?', storeId);
  assert(Number(left[0].n) === 1, 'unfollow did not remove exactly one follower');
  console.log(JSON.stringify({phase:'syntheticStoreFollow',result:'PASS',
    uniqueFollower:true,invalidForeignKeyDenied:true,restrictedStoreDeletion:true,
    counts:[2,1], testedAgainst:'disposable restore only'}));
}

try {
  console.log('STORE_FOLLOW_ISOLATED_ACCEPTANCE_STARTED; development source SELECT/dump only');
  console.log(JSON.stringify({phase:'migrationSource',sha256:sha(migrationText),result:'PASS'}));
  await databaseIdentity(source, SOURCE);
  const tableNames = await inventory(source);
  assert(tableNames.some(x => x.toLowerCase() === 'user') &&
    tableNames.some(x => x.toLowerCase() === 'sellerprofile') &&
    tableNames.some(x => x.toLowerCase() === '_prisma_migrations'), 'source core tables missing');
  assert(!tableNames.some(x => x.toLowerCase() === 'storefollow'), 'source already has StoreFollow table');
  const applied = await source.$queryRawUnsafe<Array<{migration_name: string}>>(
    "SELECT migration_name FROM `_prisma_migrations` WHERE migration_name='20261117180000_store_follows' AND finished_at IS NOT NULL");
  assert(applied.length === 0, 'StoreFollow migration already recorded in source');
  const before = await snapshot(source, tableNames);

  mkdirSync(backupDir, { recursive: false, mode: 0o700 });
  lock(backupDir);
  const out = openSync(dumpFile, 'wx', 0o600);
  try {
    cli(MYSQLDUMP, [...commonArgs, '--single-transaction', '--quick', '--hex-blob',
      '--skip-add-drop-table', '--no-tablespaces', '--default-character-set=utf8mb4',
      '--routines', '--triggers', '--events', SOURCE], undefined, out);
  } finally { closeSync(out); }
  const backup = readFileSync(dumpFile);
  assert(backup.length > 1000, 'unexpectedly small dump');
  const dumpText = backup.toString('utf8');
  assert(dumpText.includes('CREATE TABLE') &&
    !/(?:^|\n)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(dumpText),
    'dump contains unapproved database switching or drop statements');
  const dumpHash = sha(backup);
  assert(sha(readFileSync(dumpFile)) === dumpHash, 'retained SQL checksum mismatch');
  const mediaSource = resolve(process.env.UPLOAD_DIR ?? './uploads');
  const mediaBefore = photoHashes(mediaSource);
  if (existsSync(mediaSource)) cpSync(mediaSource, join(backupDir, 'uploads'), { recursive: true, force: false });
  const mediaAfter = photoHashes(join(backupDir,'uploads'));
  assert(same(mediaBefore,mediaAfter), 'retained upload files do not match their sources');
  const manifest = { createdAt:new Date().toISOString(), db:SOURCE,
    sqlBytes:backup.length, sqlSha256:dumpHash, migrationSha256:sha(migrationText),
    uploadFiles:Object.keys(mediaAfter).length, tableCount:tableNames.length, purpose:'store-follow isolated acceptance' };
  writeFileSync(join(backupDir,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
  retained = true;
  const afterBackup = await snapshot(source,tableNames);
  assert(same(before,afterBackup),'source rows changed during backup; retained backup must be rechecked');
  console.log(JSON.stringify({phase:'retainedBackup',result:'PASS',
    dir:backupDir, sqlBytes:backup.length, sha256:dumpHash,
    uploadFiles:manifest.uploadFiles, tables:tableNames.length, sourceUnchanged:true}));

  const exists = await source.$queryRawUnsafe<Array<{name:string}>>(
    'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',scratch);
  assert(exists.length === 0,'disposable schema name already occupied');
  assert(scratch.startsWith(PREFIX),'invalid scratch prefix');
  await source.$executeRawUnsafe('CREATE DATABASE '+quote(scratch)+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  created = true;
  const input = openSync(dumpFile,'r');
  try { cli(MYSQL,[...commonArgs,'--default-character-set=utf8mb4','--database='+scratch],input); }
  finally { closeSync(input); }
  restored = new PrismaClient({ datasources:{db:{url:restoreUrl.toString()}} });
  await databaseIdentity(restored,scratch);
  const restoredTables = await inventory(restored);
  assert(same(tableNames,restoredTables),'restored table inventory differs');
  const restoredBaseline = await snapshot(restored,tableNames);
  assert(same(before,restoredBaseline),'restored row-count or content digest differs from source');
  console.log(JSON.stringify({phase:'isolatedRestore',result:'PASS',tables:tableNames.length,rowsUnchanged:true}));

  await restored.$executeRawUnsafe(sql);
  const updatedTables = await inventory(restored);
  assert(updatedTables.length === tableNames.length+1 && updatedTables.some(x => x.toLowerCase() === 'storefollow'),
    'StoreFollow was not the only new table');
  const keys = await restored.$queryRawUnsafe<Array<{col:string}>>(
    "SELECT COLUMN_NAME AS col FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow' AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION");
  assert(same(keys.map(k=>k.col),['userId','sellerProfileId']),'wrong composite primary key');
  const references = await restored.$queryRawUnsafe<Array<{columnName:string; targetTable:string; deleteRule:string}>>(
    "SELECT k.COLUMN_NAME AS columnName,k.REFERENCED_TABLE_NAME AS targetTable,r.DELETE_RULE AS deleteRule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='StoreFollow' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.COLUMN_NAME");
  assert(references.length === 2 &&
    references.some(x=>x.columnName==='userId' && x.targetTable.toLowerCase()==='user' && x.deleteRule==='RESTRICT') &&
    references.some(x=>x.columnName==='sellerProfileId' && x.targetTable.toLowerCase()==='sellerprofile' && x.deleteRule==='RESTRICT'),
    'FK targets or RESTRICT policies differ from approved design');
  const indexes = await restored.$queryRawUnsafe<Array<{indexName:string; col:string}>>(
    "SELECT INDEX_NAME AS indexName,COLUMN_NAME AS col FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
  assert(indexes.some(x=>x.indexName==='StoreFollow_sellerProfileId_createdAt_idx' && x.col==='sellerProfileId') &&
    indexes.some(x=>x.indexName==='StoreFollow_sellerProfileId_createdAt_idx' && x.col==='createdAt'),
    'follow store/time index missing');
  assert(same(before,await snapshot(restored,tableNames)),
    'existing restored rows changed after isolated migration');
  console.log(JSON.stringify({phase:'isolatedMigration',result:'PASS',
    newTable:'StoreFollow',primaryKeyVerified:true,foreignKeysVerified:true,indexVerified:true,priorRowsUnchanged:true}));

  await runSynthetic(restored);
  assert(same(before,await snapshot(source,tableNames)),
    'source development database changed during isolated test');
  console.log(JSON.stringify({phase:'sourcePostcheck',result:'PASS',
    sourceDataUnchanged:true, sourceMigrationApplied:false}));
  console.log(JSON.stringify({phase:'overall',result:'PASS', backupRetained:true,
    appliedTo:'disposable restore only', developmentMigrationApplied:false}));
} catch(error) {
  errors++;
  console.error('STORE_FOLLOW_ISOLATED_ACCEPTANCE_FAILED: ' +
    (error instanceof Error ? error.message : 'unknown failure'));
  console.error('No StoreFollow migration was applied to the development schema.');
} finally {
  if (restored) await restored.$disconnect();
  if (created) {
    try {
      await databaseIdentity(source,SOURCE);
      assert(scratch.startsWith(PREFIX),'unsafe scratch identifier at cleanup');
      await source.$executeRawUnsafe('DROP DATABASE '+quote(scratch));
      console.log('ISOLATED_CLEANUP: temporary uniquely named restored database removed.');
    } catch {
      errors++;
      console.error('CLEANUP_BLOCKED: only the isolated test schema may remain; inspect before cleanup.');
    }
  }
  await source.$disconnect();
  console.log(JSON.stringify({retainedBackup:retained,sourceMigrationApplied:false,errorCount:errors}));
  if (errors) process.exitCode=1;
}
