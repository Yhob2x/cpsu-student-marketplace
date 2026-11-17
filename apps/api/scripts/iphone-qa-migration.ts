/**
 * Approved owner-only iPhone QA schema upgrade. Backup and deployment modes are
 * separately gated. NEVER run on cpsu_marketplace or a non-loopback database.
 *
 * From apps/api with local .env source identity:
 *   CPSU_IPHONE_QA_MIGRATIONS=approved bun scripts/iphone-qa-migration.ts --backup
 *   CPSU_IPHONE_QA_MIGRATIONS=approved bun scripts/iphone-qa-migration.ts --migrate <backup dir>
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync, openSync, closeSync, realpathSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';

const mode = process.argv[2];
if (!['--backup', '--migrate'].includes(mode) || process.env.CPSU_IPHONE_QA_MIGRATIONS !== 'approved') {
  throw new Error('REFUSED: explicit approved --backup / --migrate required.');
}
const source = new URL(process.env.DATABASE_URL ?? '');
if (process.platform !== 'win32' || process.env.NODE_ENV === 'production' ||
  source.protocol !== 'mysql:' || source.hostname !== '127.0.0.1' ||
  source.port !== '3306' || source.pathname !== '/cpsu_marketplace' ||
  source.search || source.hash) {
  throw new Error('REFUSED: only local source identity; neither source nor remote DB may be migrated.');
}
const target = new URL(source);
target.pathname = '/cpsu_marketplace_push_test';
const TEST_DB = 'cpsu_marketplace_push_test';
const dirBase = join(process.env.LOCALAPPDATA || '', 'CPSU-Marketplace','iphone-lan-https');
if (!process.env.LOCALAPPDATA || !existsSync(dirBase)) throw new Error('REFUSED: restricted QA storage unavailable.');
const migrationNames = [
 '20261116220000_managed_student_content',
 '20261116221000_pending_announcement_edits',
 '20261117123000_seller_avatar_review',
];
const root = resolve(import.meta.dir, '../prisma/migrations');
const hash = (buf: Buffer | string) => createHash('sha256').update(buf).digest('hex');
function migrationHashes() {
  return Object.fromEntries(migrationNames.map(name => {
    const data = readFileSync(join(root,name,'migration.sql'));
    return [name,hash(data)];
  }));
}
async function assertIdentity(prisma: PrismaClient) {
  const databases = await prisma.$queryRawUnsafe<Array<{ db: string }>>('SELECT DATABASE() AS db');
  if (databases.length !== 1 || databases[0].db !== TEST_DB) throw new Error('REFUSED: actual SQL DB identity mismatch.');
}
const prisma = new PrismaClient({ datasources: { db: { url: target.href } } });
async function catalog(prisma: PrismaClient) {
  await assertIdentity(prisma);
  const tables = await prisma.$queryRawUnsafe<Array<{name:string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
  const out: Record<string,number> = {};
  for(const {name} of tables) {
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Unsafe table identity');
    const n = await prisma.$queryRawUnsafe<Array<{c:bigint}>>('SELECT COUNT(*) AS c FROM `'+name+'`');
    out[name] = Number(n[0]?.c ?? -1);
  }
  return out;
}
async function applied(prisma: PrismaClient) {
  await assertIdentity(prisma);
  const rows = await prisma.$queryRawUnsafe<Array<{migration_name:string;finished_at:Date|null;rolled_back_at:Date|null}>>(
    'SELECT migration_name,finished_at,rolled_back_at FROM `_prisma_migrations` ORDER BY migration_name');
  if(rows.some(x => !x.finished_at || x.rolled_back_at)) throw new Error('REFUSED: incomplete migration ledger');
  return rows.map(x=>x.migration_name);
}
async function runPrisma(action:'status'|'deploy') {
  const env = { ...process.env, DATABASE_URL: target.href, NODE_ENV:'test', BUN_ENV:'test',
    MEDIA_STORAGE:'local', GOOGLE_DRIVE_CLIENT_ID:'', GOOGLE_DRIVE_CLIENT_SECRET:'',
    GOOGLE_DRIVE_REFRESH_TOKEN:'', GOOGLE_DRIVE_FOLDER_ID:'',
    PUSH_DELIVERY_ENABLED:'false', PUSH_SUBSCRIPTIONS_ENABLED:'false' };
  const cp = Bun.spawn(['bunx', 'prisma', 'migrate',action],{
    cwd: resolve(import.meta.dir,'..'), env, stdout:'pipe',stderr:'pipe',
  });
  const [out,err,code] = await Promise.all([new Response(cp.stdout).text(),new Response(cp.stderr).text(),cp.exited]);
  const message = out+'\n'+err;
  if (!message.includes('MySQL database "' + TEST_DB + '" at "127.0.0.1:3306"'))
    throw new Error('REFUSED: Prisma did not confirm isolated target ' + TEST_DB);
  if (action==='status') {
    if (![0,1].includes(code)) throw new Error('Unexpected Prisma status exit='+code);
  } else if (code!==0) throw new Error('Isolated migrate deploy failed; review Prisma diagnostics locally. Exit='+code+'; '+message.slice(-1800));
  return { code, message };
}

try {
  const current = await applied(prisma);
  const required = [
   '20261110063101_init','20261110090354_message_status',
   '20261111160700_stage1_integrity','20261111161500_wp2_listing_states',
   '20261116094000_pwa_push_notifications','20261116193000_wp3_transactions',
  ];
  if(current.length !== (mode==='--backup' ? 6 : 6) ||
    current.some((v,i)=>v!==required[i])) {
    throw new Error('REFUSED: isolated migration baseline is not exactly the expected six migrations.');
  }
  const baseline = await catalog(prisma);
  if(Object.keys(baseline).length!==24 || baseline.Campus!==1 || baseline.User!==0 ||
    baseline.Listing!==0 || baseline.SellerProfile!==0 || baseline._prisma_migrations!==6) {
    throw new Error('REFUSED: unexpected isolated test DB data/catalog before schema upgrade.');
  }
  const currentHashes = migrationHashes();
  const avatarSql = readFileSync(join(root,migrationNames[2],'migration.sql'),'utf8');
  const schema = readFileSync(resolve(import.meta.dir,'../prisma/schema.prisma'),'utf8');
  const sellerModel = schema.match(/model SellerProfile\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  if (!/\bavatarPath\s+String\?\s+@db.VarChar\(255\)/.test(sellerModel) ||
     /\bpendingAvatarPath\b/.test(sellerModel) ||
     !/ADD COLUMN `avatarPath` VARCHAR\(255\) NULL/.test(avatarSql) ||
     /pendingAvatarPath/.test(avatarSql)) {
    throw new Error('REFUSED: live seller-avatar model and migration do not agree.');
  }
  if(mode==='--backup') {
    if (process.argv.length !== 3) throw new Error('Unexpected backup arguments');
    const location = mkdtempSync(join(dirBase,'iphone-schema-pre-migrate-'));
    const dump = join(location, TEST_DB+'.sql');
    const fd = openSync(dump, 'wx', 0o600);
    let result;
    try {
      result = spawnSync('C:\\xampp\\mysql\\bin\\mariadb-dump.exe',[
        '--protocol=TCP', '--host=127.0.0.1','--port=3306',
        '--user='+decodeURIComponent(source.username),
        '--single-transaction','--quick','--hex-blob',
        '--skip-add-drop-table','--default-character-set=utf8mb4',
        '--routines','--triggers','--events',TEST_DB
      ], {env:{...process.env,MYSQL_PWD:decodeURIComponent(source.password)},
        stdio:['ignore',fd,'pipe'],windowsHide:true,timeout:120000});
    } finally {closeSync(fd);}
    if(result.error || result.status!==0) throw new Error('QA SQL backup failed. No migration performed.');
    const dumpBytes=readFileSync(dump);
    const dumpText=dumpBytes.toString('utf8');
    if(dumpBytes.length<12000 || !dumpText.includes('CREATE TABLE `_prisma_migrations`') ||
      !dumpText.includes('CREATE TABLE `Campus`') || !dumpText.includes('Cauayan Campus') ||
      (dumpText.match(/CREATE TABLE `/g)??[]).length!==24) {
      throw new Error('REFUSED: test SQL dump incomplete; no migration performed.');
    }
    const after = await catalog(prisma);
    const again = await applied(prisma);
    if(JSON.stringify(baseline)!==JSON.stringify(after) || JSON.stringify(current)!==JSON.stringify(again))
      throw new Error('REFUSED: test schema changed during dump; no migration performed.');
    const manifest={
      type:'CPSU_IPHONE_QA_TEST_ONLY', database:TEST_DB, createdAt:new Date().toISOString(),
      sqlFile:TEST_DB+'.sql', bytes:dumpBytes.length, sha256:hash(dumpBytes),
      tableCounts:baseline, migrationNames:current, migrationHashes:currentHashes,
    };
    writeFileSync(join(location,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});
    console.log('QA_BACKUP_PASS folder='+location);
    console.log('QA_BACKUP_SHA256='+manifest.sha256+'; bytes='+manifest.bytes+'; tables='+Object.keys(baseline).length);
    console.log('QA_BACKUP_SOURCE=ONLY '+TEST_DB+'; no dev DB modified');
  } else {
    if(process.argv.length!==4) throw new Error('Backup manifest folder argument required');
    const location=resolve(process.argv[3]);
    const verified=realpathSync(location);
    const trustedRoot=realpathSync(dirBase);
    if(!verified.toLowerCase().startsWith((trustedRoot+sep).toLowerCase()) ||
      !location.toLowerCase().startsWith((trustedRoot+sep).toLowerCase()) ||
      !verified.toLowerCase().includes('iphone-schema-pre-migrate-')) {
      throw new Error('REFUSED: untrusted backup path');
    }
    const manifest=JSON.parse(readFileSync(join(location,'manifest.json'),'utf8')) as any;
    const dump=readFileSync(join(location,TEST_DB+'.sql'));
    if(manifest.type!=='CPSU_IPHONE_QA_TEST_ONLY' || manifest.database!==TEST_DB ||
      manifest.sqlFile!==TEST_DB+'.sql' || manifest.bytes!==dump.length ||
      manifest.sha256!==hash(dump) ||
      Date.now()-Date.parse(manifest.createdAt)>3*3600_000 ||
      JSON.stringify(manifest.tableCounts)!==JSON.stringify(baseline) ||
      JSON.stringify(manifest.migrationNames)!==JSON.stringify(current) ||
      JSON.stringify(manifest.migrationHashes)!==JSON.stringify(currentHashes)) {
      throw new Error('REFUSED: invalid/stale/changed backup or migrations; no schema changes.');
    }
    const before=await runPrisma('status');
    if(before.code!==1 || !migrationNames.every(n=>before.message.includes(n))) {
      throw new Error('REFUSED: isolated Prisma migration status not exactly expected pending chain.');
    }
    console.log('QA_MIGRATION_PREFLIGHT_PASS target='+TEST_DB+
      '; backedUpTables='+Object.keys(baseline).length+'; three additive migrations confirmed pending.');
    const deployed=await runPrisma('deploy');
    const after=await applied(prisma);
    if (after.length!==9 || migrationNames.some((n,i)=>after[6+i]!==n)) {
      throw new Error('QA migrations applied unexpectedly; do not proceed to fixtures.');
    }
    const cols=await prisma.$queryRawUnsafe<Array<{COLUMN_NAME:string}>>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SellerProfile' AND COLUMN_NAME='avatarPath'");
    const afterCatalog=await catalog(prisma);
    if(cols.length!==1 || afterCatalog.Campus!==1 || afterCatalog.User!==0 ||
      afterCatalog.Listing!==0 || afterCatalog.SellerProfile!==0 ||
      !('Announcement' in afterCatalog) || !('GuidelineContent' in afterCatalog)) {
      throw new Error('QA post-migration schema verification failed; inspect only test DB');
    }
    console.log('QA_MIGRATION_DEPLOY_PASS '+TEST_DB+'; applied='+migrationNames.join(','));
    console.log('QA_DATA_PRESERVED Cauayan campus=1, users=0, listings=0; tables='+Object.keys(afterCatalog).length);
    console.log('QA_BACKUP_RETAINED '+location);
  }
} finally { await prisma.$disconnect(); }
