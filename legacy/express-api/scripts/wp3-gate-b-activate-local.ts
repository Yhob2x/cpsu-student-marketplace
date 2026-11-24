/**
 * Gate B Option A: explicitly owner-approved WP3-only activation on the local
 * development database. Requires a recent, independently rehearsed private
 * backup. Preserves unrelated Prisma source migration directories.
 *
 * bun scripts/wp3-gate-b-activate-local.ts --gate-b-wp3-dev --verified-backup "C:\\...\\backups\\TIMESTAMP"
 *
 * No production, no default migration chain, no rollback/reset, no Git actions.
 * A failed DDL attempt leaves source for manual investigation; do not retry.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  cpSync, copyFileSync, existsSync, readFileSync, readdirSync, realpathSync,
  mkdirSync, mkdtempSync, rmSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import {
  EXPECTED_TABLES, WP3_MIGRATION, assertBackupLocation, assertDump,
  assertBackupManifest, assertWp3Migration, canonicalRowsHash, projectLegacyRow,
  type Snapshot,
} from './wp3-restore-safety.js';
import {
  EXPECTED_APPLIED, EXPECTED_MIGRATIONS, assessGateB,
  type AppliedMigration, type MigrationOnDisk,
} from './wp3-gate-b-readonly-policy.js';
import { assertFreshWp3Backup, assertWp3ActivationAfter } from './wp3-gate-b-activation-safety.js';

const fail = (message: string): never => { throw new Error(message); };
if (process.argv.length !== 5 ||
    process.argv[2] !== '--gate-b-wp3-dev' ||
    process.argv[3] !== '--verified-backup') {
  fail('Gate B refuses execution without --gate-b-wp3-dev --verified-backup <private path>.');
}

const dbUrl = process.env.DATABASE_URL ?? '';
let url: URL;
try { url = new URL(dbUrl); } catch { fail('Invalid development database identity.'); }
if (process.env.NODE_ENV === 'production' || url.protocol !== 'mysql:' ||
    url.hostname !== '127.0.0.1' || url.port !== '3306' ||
    url.pathname !== '/cpsu_marketplace' || url.search || url.hash) {
  fail('Gate B only permits exact 127.0.0.1:3306/cpsu_marketplace, nonproduction.');
}

const backup = resolve(process.argv[4]);
assertBackupLocation(backup, homedir());
if (!existsSync(backup) || realpathSync(backup).toLowerCase() !== backup.toLowerCase())
  fail('Private backup missing or symlinked.');
const manifest = JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8')) as {
  createdAt: string; database: string; backupFilename: string;
  sqlBytes: number; sqlSha256: string; uploadFileCount: number;
};
assertFreshWp3Backup(manifest.createdAt);
const sqlBytes = readFileSync(join(backup, 'cpsu_marketplace.sql'));
assertDump(sqlBytes.toString('utf8'));

function mediaHashes(base: string): string[] {
  if (!existsSync(base)) return [];
  const list: string[] = [];
  function walk(dir: string) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      if (entry.isSymbolicLink()) fail('Unsafe upload symlink.');
      const full = join(dir,entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) list.push(
        relative(base,full).replaceAll('\\','/')+':'+
        createHash('sha256').update(readFileSync(full)).digest('hex'));
      else fail('Unsafe upload file type.');
    }
  }
  walk(base);
  return list.sort();
}
const backedMedia = mediaHashes(join(backup,'uploads'));
assertBackupManifest(manifest,sqlBytes,backedMedia.length);
const liveUploads = resolve(process.env.UPLOAD_DIR ?? './uploads');
if (JSON.stringify(backedMedia) !== JSON.stringify(mediaHashes(liveUploads)))
  fail('Uploads no longer match independently verified retained backup.');

const prismaRoot = resolve(import.meta.dir,'../prisma');
const migrationsRoot = join(prismaRoot,'migrations');
function migrationInventory(): { disk:MigrationOnDisk[]; fingerprint:string } {
  const disk = readdirSync(migrationsRoot,{withFileTypes:true})
    .filter(d=>d.isDirectory() && /^\d{14}_/.test(d.name))
    .map(d=>({name:d.name,sha256:createHash('sha256')
      .update(readFileSync(join(migrationsRoot,d.name,'migration.sql')))
      .digest('hex').toUpperCase()}))
    .sort((a,b)=>a.name.localeCompare(b.name));
  const fingerprint = createHash('sha256').update(JSON.stringify({
    disk,
    schema:createHash('sha256').update(readFileSync(join(prismaRoot,'schema.prisma'))).digest('hex'),
    lock:createHash('sha256').update(readFileSync(join(migrationsRoot,'migration_lock.toml'))).digest('hex'),
  })).digest('hex');
  return {disk,fingerprint};
}
const original = migrationInventory();
assertWp3Migration(readFileSync(join(migrationsRoot,WP3_MIGRATION,'migration.sql'),'utf8'));

// No API must listen while ALTER TABLE runs. Never terminate unknown processes.
const port = spawnSync('powershell.exe',['-NoProfile','-Command',
  "(Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction SilentlyContinue | Measure-Object).Count"],{
  windowsHide:true,timeout:15000,encoding:'utf8',stdio:['ignore','pipe','pipe']});
if (port.status !== 0 || String(port.stdout).trim() !== '0')
  fail('Local API port 4000 is active; maintenance freeze failed.');

type Row = Record<string,unknown>;
type DbMigration = {migration_name:string;checksum:string;finished_at:Date|null;rolled_back_at:Date|null};
function ident(value:string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) fail('Untrusted identifier.');
  return '`'+value+'`';
}
async function tableNames(db:PrismaClient):Promise<string[]> {
  const rows=await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  return rows.map(r=>r.name.toLowerCase()).sort();
}
async function snapshot(db:PrismaClient):Promise<Snapshot> {
  const output:Snapshot={};
  for(const table of await tableNames(db)){
    const keys=await db.$queryRawUnsafe<{name:string}[]>(
      "SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION",table);
    if (!keys.length) fail('Existing table missing primary key: '+table);
    const rows=await db.$queryRawUnsafe<Row[]>(
      'SELECT * FROM '+ident(table)+' ORDER BY '+keys.map(x=>ident(x.name)).join(','));
    output[table]={count:rows.length,hash:canonicalRowsHash(rows.map(row=>projectLegacyRow(table,row)))};
  }
  return output;
}
async function history(db:PrismaClient):Promise<DbMigration[]> {
  return db.$queryRawUnsafe<DbMigration[]>(
    'SELECT migration_name,checksum,finished_at,rolled_back_at FROM `_prisma_migrations` ORDER BY started_at,migration_name');
}

let db:PrismaClient|undefined;
let scratch:string|undefined;
let ddlAttempted=false;
try {
  db=new PrismaClient({datasources:{db:{url:dbUrl}}});
  const identity=await db.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
  const preHistory=await history(db);
  const preTables=await tableNames(db);
  const result=assessGateB({
    databaseUrl:dbUrl,nodeEnv:process.env.NODE_ENV,databaseName:identity[0]?.name??'',
    diskMigrations:original.disk,
    applied:preHistory.map(r=>({
      name:r.migration_name,checksum:r.checksum,
      finished:!!r.finished_at,rolledBack:!!r.rolled_back_at,
    } satisfies AppliedMigration)),
    databaseTables:preTables,
    // The user has explicitly approved Option A and confirmed other coding
    // tasks stopped; a fresh backup/rehearsal was independently completed.
    coordinatedFreeze:true,writtenGateBApproval:true,freshBackupRestoreVerified:true,
  });
  if (!result.deploymentAuthorized) fail(result.blockers.join(','));
  if(preTables.join('|')!==EXPECTED_TABLES.slice().sort().join('|'))
    fail('Development baseline table inventory changed.');
  const sessions=await db.$queryRawUnsafe<{n:bigint}[]>(
    "SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE DB='cpsu_marketplace' AND ID<>CONNECTION_ID()");
  if(Number(sessions[0]?.n??0)!==0) fail('Other active development DB connections found.');
  const transactions=await db.$queryRawUnsafe<{n:bigint}[]>(
    'SELECT COUNT(*) AS n FROM information_schema.INNODB_TRX WHERE trx_mysql_thread_id<>CONNECTION_ID()');
  if(Number(transactions[0]?.n??0)!==0) fail('Active database transactions found.');
  if(original.fingerprint!==migrationInventory().fingerprint) fail('Source migration files changed.');
  const before=await snapshot(db);
  const legacyListing=await db.$queryRawUnsafe<Row[]>('SELECT * FROM `listing` ORDER BY `id`');
  if(JSON.stringify(backedMedia)!==JSON.stringify(mediaHashes(liveUploads)))
    fail('Uploads changed during preflight.');
  assertFreshWp3Backup(manifest.createdAt);

  scratch=mkdtempSync(join(tmpdir(),'cpsu-wp3-b-local-only-'));
  const scratchPrisma=join(scratch,'prisma');
  const scratchMigrations=join(scratchPrisma,'migrations');
  mkdirSync(scratchMigrations,{recursive:true});
  const schema=join(scratchPrisma,'schema.prisma');
  copyFileSync(join(prismaRoot,'schema.prisma'),schema);
  copyFileSync(join(migrationsRoot,'migration_lock.toml'),join(scratchMigrations,'migration_lock.toml'));
  const selected=[...EXPECTED_APPLIED,WP3_MIGRATION];
  for(const name of selected){
    cpSync(join(migrationsRoot,name),join(scratchMigrations,name),{recursive:true,force:false});
    const actual=createHash('sha256').update(readFileSync(join(scratchMigrations,name,'migration.sql')))
      .digest('hex').toUpperCase();
    if(actual!==EXPECTED_MIGRATIONS[name]) fail('Isolated migration hash changed: '+name);
  }
  const actualDirs=readdirSync(scratchMigrations,{withFileTypes:true})
    .filter(x=>x.isDirectory()).map(x=>x.name).sort();
  if(actualDirs.join('|')!==selected.slice().sort().join('|'))
    fail('Isolated migration directory contains unapproved migration.');
  if(original.fingerprint!==migrationInventory().fingerprint)
    fail('Source changed during private WP3-only chain preparation.');

  async function cli(action:'status'|'deploy') {
    const proc=Bun.spawn(['bunx','prisma','migrate',action,'--schema',schema],{
      cwd:resolve(import.meta.dir,'..'),
      env:{...process.env,DATABASE_URL:dbUrl,NODE_ENV:'development',BUN_ENV:'development'},
      stdout:'pipe',stderr:'pipe',
    });
    const [stdout,stderr,code]=await Promise.all([
      new Response(proc.stdout).text(),new Response(proc.stderr).text(),proc.exited]);
    const body=stdout+stderr;
    const expectedStatus=action==='status' && code===1 &&
      body.includes('not yet been applied') && body.includes(WP3_MIGRATION);
    if((code!==0 && !expectedStatus)||!body.includes('cpsu_marketplace')||
       !body.includes('127.0.0.1:3306'))
      fail('Prisma '+action+' failed or wrong database; exit '+code);
    if(action==='status'&&!expectedStatus)
      fail('WP3 not the sole pending migration in isolated chain.');
    if(action==='deploy'&&!body.includes(WP3_MIGRATION))
      fail('Prisma did not report WP3 deployment.');
    return body;
  }
  await cli('status');
  if(original.fingerprint!==migrationInventory().fingerprint)
    fail('Source migration inventory changed at execution boundary.');
  if (JSON.stringify(backedMedia)!==JSON.stringify(mediaHashes(liveUploads)))
    fail('Media changed at execution boundary.');
  assertFreshWp3Backup(manifest.createdAt);
  await db.$disconnect();db=undefined;
  console.log('GATE B WP3-ONLY EXECUTION: exactly six migrations in temporary Prisma tree, target local development only.');
  ddlAttempted=true;
  await cli('deploy');

  // New Prisma client after DDL avoids stale column metadata observed in Gate A.
  db=new PrismaClient({datasources:{db:{url:dbUrl}}});
  const identityAfter=await db.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
  if(identityAfter[0]?.name!=='cpsu_marketplace') fail('Post-migration target changed.');
  const after=await snapshot(db);
  const listingAfter=await db.$queryRawUnsafe<Row[]>('SELECT * FROM `listing` ORDER BY `id`');
  const afterHistory=await history(db);
  const foreign=await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
  const indexes=await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()");
  assertWp3ActivationAfter({
    before,after,oldListing:legacyListing,newListing:listingAfter,
    history:afterHistory.map(r=>({name:r.migration_name,finished:!!r.finished_at,rolledBack:!!r.rolled_back_at})),
    foreignKeys:foreign.map(r=>r.name),indexes:indexes.map(r=>r.name),
  });
  for(const row of afterHistory){
    if(row.checksum.toUpperCase()!==EXPECTED_MIGRATIONS[row.migration_name])
      fail('Applied history includes unknown or tampered migration checksum.');
  }
  if(original.fingerprint!==migrationInventory().fingerprint)
    fail('Another process changed migration files during activation.');
  if(JSON.stringify(backedMedia)!==JSON.stringify(mediaHashes(liveUploads)))
    fail('Uploads changed during activation.');
  console.log('WP3 GATE B PASS: applied exactly '+WP3_MIGRATION+
    '; 7 foreign keys and key indexes present; '+legacyListing.length+
    ' legacy listings preserved; other two migrations unapplied.');
  console.log('Private retained backup intact. No production deployment or Git action.');
} catch (e) {
  console.error('GATE B STOP: '+(e instanceof Error?e.message:'Unexpected failure'));
  if(ddlAttempted) console.error('DDL may have partially applied: leave source unchanged and inspect manually before retry/recovery.');
  process.exitCode=1;
} finally {
  if(db) await db.$disconnect();
  if(scratch) rmSync(scratch,{recursive:true,force:true});
}
