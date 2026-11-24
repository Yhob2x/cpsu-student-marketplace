/**
 * CPSU StoreReview-only backup-and-restore gate.
 * DATABASE SOURCE: READ-ONLY SELECT + mysqldump, never any mutation.
 * A brand-new randomly named MariaDB scratch database is restored and destroyed.
 * Private local backup is DPAPI-encrypted with CurrentUser; no plain SQL retained.
 * RUN: bun scripts/store-reviews-private-backup-rehearsal.ts --approved-rehearsal
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';

const guard = (truth: unknown, why: string): asserts truth => { if (!truth) throw Error('REFUSED: ' + why); };
if (process.argv.length !== 3 || process.argv[2] !== '--approved-rehearsal') throw Error('REFUSED: explicit --approved-rehearsal required');
if (process.env.NODE_ENV === 'production') throw Error('REFUSED: production environment forbidden');
const url = process.env.DATABASE_URL;
if (!url) throw Error('REFUSED: DATABASE_URL unavailable');
const u = new URL(url);
if (u.protocol !== 'mysql:' || u.hostname !== '127.0.0.1' ||
    (u.port && u.port !== '3306') || decodeURIComponent(u.pathname.slice(1)) !== 'cpsu_marketplace')
  throw Error('REFUSED: only cpsu_marketplace on local 127.0.0.1:3306 is allowed');
const MYSQL = 'C:\\xampp\\mysql\\bin\\mysql.exe';
const DUMP = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
if (!existsSync(MYSQL) || !existsSync(DUMP)) throw Error('REFUSED: missing XAMPP MariaDB CLI');
const session = randomBytes(6).toString('hex');
const scratch = 'cpsu_review_restore_' + session;
const parent = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'CPSU-Marketplace', 'backups');
mkdirSync(parent, { recursive: true });
const folder = join(parent, 'store-review-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + session);
mkdirSync(folder, { recursive: false });
const sqlFile = join(folder, 'restore-plain.tmp.sql');
const dpapiFile = join(folder, 'dev-backup.dpapi');
const manifest = join(folder, 'manifest.json');
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) };
const base = ['--protocol=TCP','--host=127.0.0.1','--port=3306','--user=' + decodeURIComponent(u.username)];
let scratchCreated = false;
let success = false;
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function cli(executable: string, args: string[], input?: number, output?: number) {
  const r = spawnSync(executable, args, { env, encoding: 'utf8', windowsHide: true,
    stdio: [input ?? 'ignore', output ?? 'ignore', 'pipe'], timeout: 180000 });
  if (r.error || r.status !== 0) throw Error('CLI failed (exit ' + r.status + '): backup or restore did not finish');
}
function sql(query: string) {
  const r = spawnSync(MYSQL, base, { env, input: query, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (r.error || r.status !== 0) throw Error('CLI SQL failed (exit ' + r.status + ')');
}
function acl(path: string) {
  const username = userInfo().username;
  const r = spawnSync('icacls.exe', [path, '/inheritance:r', '/grant:r',
    username + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'],
    { windowsHide: true, encoding: 'utf8', timeout: 30000 });
  if (r.error || r.status !== 0) throw Error('Refusing unprotected private backup folder');
}
function quote(n: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) throw Error('Unsafe DB table name');
  return '`' + n + '`';
}
function stringify(x: any) { return JSON.stringify(x, (_k, v) => typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? Array.from(v) : v); }
async function inventory(db: PrismaClient, expected: string) {
  const info = await db.$queryRawUnsafe<Array<{db: string}>>('SELECT DATABASE() AS db');
  if (info[0]?.db !== expected) throw Error('Wrong database identity');
  const tables = await db.$queryRawUnsafe<Array<{name: string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  if (!tables.some(t => t.name.toLowerCase() === 'user') || !tables.some(t => t.name.toLowerCase() === 'transaction')) throw Error('Required parent tables missing');
  const output: Record<string, { rows: number; digest: string }> = {};
  for (const t of tables) {
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM ' + quote(t.name));
    const signature = rows.map(stringify).sort();
    output[t.name] = { rows: rows.length, digest: sha(JSON.stringify(signature)) };
  }
  return output;
}
function dpapiEncrypt() {
  // No SQL data or password appears on command line or in stdout.
  const script = "Add-Type -AssemblyName System.Security; " +
    "$b=[IO.File]::ReadAllBytes($env:REVIEW_SQL_TEMP); " +
    "$c=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[IO.File]::WriteAllBytes($env:REVIEW_DPAPI_OUT,$c); " +
    "$d=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($env:REVIEW_DPAPI_OUT),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "if((Get-FileHash -InputStream ([IO.MemoryStream]::new($b)) -Algorithm SHA256).Hash -ne (Get-FileHash -InputStream ([IO.MemoryStream]::new($d)) -Algorithm SHA256).Hash){exit 10}";
  const r = spawnSync('powershell.exe', ['-NoProfile','-Command',script], {
    env: { ...env, REVIEW_SQL_TEMP: sqlFile, REVIEW_DPAPI_OUT: dpapiFile }, windowsHide: true,
    encoding: 'utf8', timeout: 120000 });
  if (r.error || r.status !== 0 || !existsSync(dpapiFile)) throw Error('DPAPI encrypted backup verification failed');
}
let source: PrismaClient | undefined, restored: PrismaClient | undefined;
try {
  acl(folder);
  source = new PrismaClient({datasources:{db:{url:u.toString()}}});
  const before = await inventory(source,'cpsu_marketplace');
  if (Object.keys(before).some(n => n.toLowerCase() === 'storereview')) throw Error('StoreReview table already exists - migration must not be applied again');
  console.log('BACKUP_SOURCE_READONLY_INVENTORY_OK tables=' + Object.keys(before).length);
  const descriptor = openSync(sqlFile, 'wx', 0o600);
  try {
    cli(DUMP,[...base,'--single-transaction','--quick','--hex-blob','--no-tablespaces',
      '--skip-add-drop-table','--default-character-set=utf8mb4',
      '--routines','--triggers','--events','cpsu_marketplace'], undefined, descriptor);
  } finally { closeSync(descriptor); }
  const bytes = readFileSync(sqlFile);
  if (bytes.length < 1000) throw Error('Unexpectedly small backup');
  if (!bytes.toString('utf8').includes('CREATE TABLE')) throw Error('Backup lacks CREATE TABLE statements');
  const digest = sha(bytes);
  sql('CREATE DATABASE ' + quote(scratch) + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  scratchCreated = true;
  const fileInput = openSync(sqlFile,'r');
  try { cli(MYSQL,[...base,'--database='+scratch],fileInput); } finally {closeSync(fileInput);}
  const copyUrl = new URL(u.toString());copyUrl.pathname = '/' + scratch;
  restored = new PrismaClient({datasources:{db:{url:copyUrl.toString()}}});
  const mirror = await inventory(restored,scratch);
  if (stringify(before) !== stringify(mirror)) throw Error('Restore verification mismatch');
  await source.$disconnect();source = undefined;
  const stillSame = new PrismaClient({datasources:{db:{url:u.toString()}}});
  try {
    const after = await inventory(stillSame,'cpsu_marketplace');
    if (stringify(before) !== stringify(after)) throw Error('Source rows changed during backup rehearsal');
  } finally { await stillSame.$disconnect(); }
  console.log('BACKUP_RESTORE_VERIFIED tables=' + Object.keys(before).length);
  dpapiEncrypt();
  if (sha(readFileSync(sqlFile)) !== digest) throw Error('Backup checksum changed');
  unlinkSync(sqlFile);
  writeFileSync(manifest, JSON.stringify({
    purpose:'CPSU local StoreReview-only approved development migration',
    sourceDatabase:'cpsu_marketplace', state:'RESTORE_VERIFIED',
    dumpSha256:digest, encryptedSha256:sha(readFileSync(dpapiFile)),
    sourceTableCount:Object.keys(before).length,
    sourceRecordCounts:Object.fromEntries(Object.entries(before).map(([k,v])=>[k,v.rows])),
    encryptedBackup:'dev-backup.dpapi',
    restoreType:'disposable 1:1 MariaDB clone', protection:'Windows CurrentUser DPAPI',
  },null,2),{flag:'wx'});
  success = true;
  console.log('BACKUP_GATE_PASS encryptedBackup=' + dpapiFile + ' manifest=' + manifest);
} finally {
  if (source) await source.$disconnect();
  if (restored) await restored.$disconnect();
  if (scratchCreated) {
    try { sql('DROP DATABASE ' + quote(scratch));console.log('SCRATCH_RESTORE_REMOVED=true'); }
    catch {console.log('SCRATCH_CLEANUP_FAILED=' + scratch);process.exitCode=1;}
  }
  if (existsSync(sqlFile)) rmSync(sqlFile,{force:true});
  if (!success) console.error('BACKUP_GATE_FAILED: development schema unchanged; review private backup folder ' + folder);
}
