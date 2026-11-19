/**
 * Approved local-only StoreAppreciation activation.
 * Guards: exact local dev database, encrypted backup, verified isolated restore,
 * scratch-only acceptance, approved single-table DDL, Prisma migration record.
 * Never invokes migrate deploy; private student identity remains pending.
 *
 * bun scripts/activate-store-appreciation-local.ts --approved-appreciation-only
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';

const NAME = '20261119093000_store_appreciations';
const SOURCE = 'cpsu_marketplace';
const PREFIX = 'cpsu_appreciation_rehearsal_';
const mysql = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const mysqldump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const migrationFile = resolve(import.meta.dir, '../prisma/migrations/' + NAME + '/migration.sql');
const ensure = (ok: unknown, reason: string): asserts ok => { if (!ok) throw Error('REFUSED: ' + reason); };
const sha = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const norm = (data: unknown) => JSON.stringify(data, (_, value) =>
  typeof value === 'bigint' ? value.toString() :
    value instanceof Uint8Array ? Array.from(value) : value);
function quote(name: string) {
  ensure(/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name), 'invalid SQL identifier');
  return '`' + name + '`';
}
ensure(process.argv.length === 3 && process.argv[2] === '--approved-appreciation-only',
  'explicit user-approved appreciation-only flag required');
ensure(process.env.NODE_ENV !== 'production', 'production is not authorized');
const sourceString = process.env.DATABASE_URL;
ensure(sourceString, 'missing database URL');
const u = new URL(sourceString);
ensure(u.protocol === 'mysql:' && u.hostname === '127.0.0.1' &&
  (!u.port || u.port === '3306') && decodeURIComponent(u.pathname.slice(1)) === SOURCE,
  'only local 127.0.0.1:3306/cpsu_marketplace is authorized');
ensure(existsSync(mysql) && existsSync(mysqldump), 'XAMPP database CLI missing');
const migrationOriginal = readFileSync(migrationFile, 'utf8');
const ddl = migrationOriginal.split(/\r?\n/).filter(s => !/^\s*--/.test(s)).join('\n').trim();
ensure(ddl.startsWith('CREATE TABLE `StoreAppreciation` (') &&
  ddl.split(';').filter(s => s.trim()).length === 1 &&
  ddl.includes('PRIMARY KEY (`userId`, `sellerProfileId`)') &&
  ddl.includes('FOREIGN KEY (`userId`) REFERENCES `User`(`id`)') &&
  ddl.includes('FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile`(`id`)') &&
  ddl.includes('StoreAppreciation_sellerProfileId_createdAt_idx') &&
  !/\b(?:DROP|TRUNCATE|ALTER)\s+(?:TABLE|DATABASE)\b/i.test(ddl),
  'migration is not the reviewed single-table additive StoreAppreciation DDL');

const scratch = PREFIX + randomBytes(6).toString('hex');
const backupParent = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
  'CPSU-Marketplace', 'backups');
const backupDir = join(backupParent, 'store-appreciation-' +
  new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
const plainFile = join(backupDir, 'restore-plain.tmp.sql');
const encryptedFile = join(backupDir, 'dev-backup.dpapi');
const manifestFile = join(backupDir, 'manifest.json');
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) };
const common = ['--protocol=TCP','--host=127.0.0.1','--port=3306',
  '--user=' + decodeURIComponent(u.username)];
function cli(exe: string, args: string[], input?: number, output?: number) {
  const r = spawnSync(exe, args, { env, encoding: 'utf8', windowsHide: true,
    stdio: [input ?? 'ignore', output ?? 'ignore', 'pipe'], timeout: 240000 });
  if (r.error || r.status !== 0) throw Error('Backup/restore CLI failed (exit ' + r.status + ')');
}
function acl(folder: string) {
  const who = userInfo().username;
  const result = spawnSync('icacls.exe',[folder,'/inheritance:r','/grant:r',
    who + ':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],
  { encoding:'utf8', windowsHide:true, timeout:30000 });
  ensure(!result.error && result.status === 0, 'cannot restrict backup permissions');
}
function encryptBackup() {
  const command = 'Add-Type -AssemblyName System.Security; ' +
    '$b=[IO.File]::ReadAllBytes($env:APPRECIATION_SQL_TEMP); ' +
    '$c=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); ' +
    '[IO.File]::WriteAllBytes($env:APPRECIATION_DPAPI_OUT,$c); ' +
    '$d=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($env:APPRECIATION_DPAPI_OUT),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); ' +
    'if((Get-FileHash -InputStream ([IO.MemoryStream]::new($b)) -Algorithm SHA256).Hash -ne ' +
    '(Get-FileHash -InputStream ([IO.MemoryStream]::new($d)) -Algorithm SHA256).Hash){exit 10}';
  const result = spawnSync('powershell.exe',['-NoProfile','-Command',command],{
    env:{ ...env, APPRECIATION_SQL_TEMP:plainFile, APPRECIATION_DPAPI_OUT:encryptedFile },
    windowsHide:true, encoding:'utf8', timeout:120000 });
  ensure(!result.error && result.status === 0 && existsSync(encryptedFile),
    'private encrypted backup verification failed');
}
const source = new PrismaClient({ datasources: { db: { url: u.toString() } } });
let restored: PrismaClient | undefined;
let scratchCreated = false;
let activated = false;
let backupSafe = false;
type Table = { name: string };
async function tableNames(db: PrismaClient) {
  const result = await db.$queryRawUnsafe<Table[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  return result.map(x => x.name);
}
async function identity(db: PrismaClient, expected: string) {
  const data = await db.$queryRawUnsafe<Array<{n:string}>>('SELECT DATABASE() AS n');
  ensure(data[0]?.n === expected, 'database identity mismatch: ' + expected);
}
async function snapshot(db: PrismaClient, names: string[]) {
  const output: Record<string,{rows:number,digest:string}> = {};
  for(const name of names) {
    const rows = await db.$queryRawUnsafe<Record<string,unknown>[]>('SELECT * FROM ' + quote(name));
    output[name] = { rows:rows.length, digest:sha(norm(rows.map(norm).sort())) };
  }
  return output;
}
function same(a: unknown,b: unknown) { return norm(a) === norm(b); }
async function checkSchema(db: PrismaClient, expectedDatabase: string, oldCount: number) {
  await identity(db, expectedDatabase);
  const names = await tableNames(db);
  ensure(names.length === oldCount + 1 &&
    names.filter(n => n.toLowerCase() === 'storeappreciation').length === 1,
    'only StoreAppreciation may be added');
  const keys = await db.$queryRawUnsafe<Array<{ col: string }>>(
    "SELECT COLUMN_NAME AS col FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='storeappreciation' AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION");
  ensure(same(keys.map(x=>x.col), ['userId','sellerProfileId']), 'primary key is wrong');
  const refs = await db.$queryRawUnsafe<Array<{col:string;ref:string;rule:string}>>(
    "SELECT k.COLUMN_NAME AS col,k.REFERENCED_TABLE_NAME AS ref,r.DELETE_RULE AS rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND LOWER(k.TABLE_NAME)='storeappreciation' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.COLUMN_NAME");
  ensure(refs.length === 2 && refs.every(x => x.rule === 'RESTRICT') &&
    refs.some(x=>x.col==='userId' && x.ref.toLowerCase()==='user') &&
    refs.some(x=>x.col==='sellerProfileId' && x.ref.toLowerCase()==='sellerprofile'),
    'foreign-key constraints are wrong');
  const ix = await db.$queryRawUnsafe<Array<{idx:string;col:string}>>(
    "SELECT INDEX_NAME AS idx,COLUMN_NAME AS col FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='storeappreciation' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
  ensure(ix.filter(x=>x.idx==='StoreAppreciation_sellerProfileId_createdAt_idx')
    .map(x=>x.col).join(',')==='sellerProfileId,createdAt','lookup index is wrong');
}
try {
  await identity(source,SOURCE);
  const beforeTables = await tableNames(source);
  ensure(beforeTables.some(n=>n.toLowerCase()==='user') &&
    beforeTables.some(n=>n.toLowerCase()==='sellerprofile') &&
    beforeTables.includes('_prisma_migrations'), 'unexpected development schema');
  ensure(!beforeTables.some(n=>n.toLowerCase()==='storeappreciation'),
    'StoreAppreciation already exists, refusing duplicate migration');
  const prior = await source.$queryRawUnsafe<Array<{migration_name:string}>>(
    'SELECT migration_name FROM `_prisma_migrations` WHERE migration_name=? AND finished_at IS NOT NULL',NAME);
  ensure(prior.length===0, 'StoreAppreciation migration already applied');
  console.log('PRECHECK_OK: target/local/schema verified, identity migration excluded');

  const before = await snapshot(source,beforeTables);
  mkdirSync(backupDir,{recursive:false,mode:0o700});
  acl(backupDir);
  const fd = openSync(plainFile,'wx',0o600);
  try {
    cli(mysqldump,[...common,'--single-transaction','--quick','--hex-blob','--no-tablespaces',
      '--skip-add-drop-table','--default-character-set=utf8mb4','--routines','--triggers','--events',
      SOURCE],undefined,fd);
  } finally { closeSync(fd); }
  const bytes = readFileSync(plainFile);
  ensure(bytes.length>1000 && bytes.toString('utf8').includes('CREATE TABLE'),
    'database backup is incomplete');
  const digest = sha(bytes);
  console.log('BACKUP_CREATED: protected private location, bytes=' + bytes.length);
  const scratchUrl = new URL(u.toString()); scratchUrl.pathname = '/' + scratch;
  const existing = await source.$queryRawUnsafe<Array<{n:string}>>(
    'SELECT SCHEMA_NAME AS n FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',scratch);
  ensure(existing.length===0, 'scratch database collision');
  await source.$executeRawUnsafe('CREATE DATABASE '+quote(scratch)+
    ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  scratchCreated = true;
  const input = openSync(plainFile,'r');
  try { cli(mysql,[...common,'--default-character-set=utf8mb4','--database='+scratch],input); }
  finally {closeSync(input);}
  restored = new PrismaClient({datasources:{db:{url:scratchUrl.toString()}}});
  await identity(restored,scratch);
  const cloneTables = await tableNames(restored);
  ensure(same(beforeTables,cloneTables) && same(before,await snapshot(restored,cloneTables)),
    'backup restore differs from development source');
  console.log('RESTORE_OK: isolated database mirrors source');
  await restored.$executeRawUnsafe(ddl);
  await checkSchema(restored,scratch,beforeTables.length);
  ensure(same(before,await snapshot(restored,beforeTables)), 'migration changed existing rows');
  const account = await restored.$queryRawUnsafe<Array<{id:number}>>('SELECT id FROM `User` LIMIT 1');
  const store = await restored.$queryRawUnsafe<Array<{id:number}>>('SELECT id FROM `SellerProfile` LIMIT 1');
  if(account.length && store.length) {
    await restored.$executeRawUnsafe(
      'INSERT INTO `StoreAppreciation` (`userId`,`sellerProfileId`) VALUES (?,?)',
      account[0].id,store[0].id);
    const count = await restored.$queryRawUnsafe<Array<{n:bigint}>>(
      'SELECT COUNT(*) AS n FROM `StoreAppreciation`');
    ensure(Number(count[0].n)===1, 'scratch appreciation count mismatch');
    let duplicateBlocked=false;
    try { await restored.$executeRawUnsafe(
      'INSERT INTO `StoreAppreciation` (`userId`,`sellerProfileId`) VALUES (?,?)',
      account[0].id,store[0].id); } catch { duplicateBlocked=true; }
    ensure(duplicateBlocked,'unique appreciation key not enforced');
    await restored.$executeRawUnsafe('DELETE FROM `StoreAppreciation`');
  }
  ensure(same(before,await snapshot(restored,beforeTables)), 'scratch tests changed original tables');
  ensure(same(before,await snapshot(source,beforeTables)), 'development rows changed during rehearsal');
  console.log('REHEARSAL_OK: constraints, isolated write/read/undo, existing rows untouched');

  encryptBackup();
  ensure(sha(readFileSync(plainFile))===digest, 'plaintext backup checksum mismatch');
  unlinkSync(plainFile);
  backupSafe = true;
  writeFileSync(manifestFile,JSON.stringify({
    purpose:'approved local StoreAppreciation-only activation',
    source:SOURCE, createdAt:new Date().toISOString(),
    sourceTableCount:beforeTables.length, sourceRows:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.rows])),
    backup:'dev-backup.dpapi', backupSha256:digest,
    encryptedSha256:sha(readFileSync(encryptedFile)), migrationSha256:sha(migrationOriginal),
    restoreVerified:true, scratchAcceptancePassed:true,
  },null,2),{flag:'wx'});
  console.log('BACKUP_GATE_OK: encrypted and restore-verified; no plaintext retained');
  ensure(same(before,await snapshot(source,beforeTables)),
    'development records changed before activation');
  await identity(source,SOURCE);
  ensure(! (await tableNames(source)).some(n=>n.toLowerCase()==='storeappreciation'),
    'development appreciation table appeared during rehearsal');
  await source.$executeRawUnsafe(ddl);
  activated = true;
  await checkSchema(source,SOURCE,beforeTables.length);
  ensure(same(before,await snapshot(source,beforeTables)),
    'unexpected existing-row mutation after activation');
  console.log('ACTIVATION_DDL_OK: created only StoreAppreciation table');

  const resolver = spawnSync(process.execPath,
    ['x','prisma','migrate','resolve','--applied',NAME],{
      cwd:resolve(import.meta.dir,'..'),env,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  ensure(!resolver.error && resolver.status===0,
    'Prisma migration registration failed: the new table exists, but needs manual review before retry');
  const recorded = await source.$queryRawUnsafe<Array<{ migration_name:string }>>(
    'SELECT migration_name FROM `_prisma_migrations` WHERE migration_name=? AND finished_at IS NOT NULL',NAME);
  ensure(recorded.length===1, 'migration metadata not recorded');
  const stillPending = await source.$queryRawUnsafe<Array<{ migration_name:string }>>(
    "SELECT migration_name FROM `_prisma_migrations` WHERE migration_name='20261117230000_private_student_identity' AND finished_at IS NOT NULL");
  ensure(stillPending.length===0,'unrelated private student identity was unexpectedly activated');
  const newRows = await source.$queryRawUnsafe<Array<{n:bigint}>>(
    'SELECT COUNT(*) AS n FROM `StoreAppreciation`');
  ensure(Number(newRows[0]?.n)===0,'new appreciation table should start empty');
  console.log('ACTIVATION_SUCCESS: appreciation ready, migration registered, private identity not activated, existing data unchanged');
  console.log('ENCRYPTED_BACKUP_LOCATION: '+encryptedFile);
} catch(e) {
  console.error('ACTIVATION_HALTED: '+(e instanceof Error ? e.message : 'unknown failure'));
  console.error('Source appreciation DDL applied: '+activated+'; retained backup ready: '+backupSafe);
  process.exitCode=1;
} finally {
  if(restored) await restored.$disconnect();
  if(scratchCreated) {
    try {
      await identity(source,SOURCE);
      ensure(scratch.startsWith(PREFIX), 'unexpected scratch schema');
      await source.$executeRawUnsafe('DROP DATABASE '+quote(scratch));
      console.log('SCRATCH_CLEANUP_OK');
    } catch { console.error('SCRATCH_CLEANUP_FAILED: inspect disposable schema only');process.exitCode=1; }
  }
  await source.$disconnect();
  if(existsSync(plainFile)) rmSync(plainFile,{force:true});
}
