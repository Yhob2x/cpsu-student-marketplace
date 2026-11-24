/**
 * One-time approved local CPSU seller-avatar schema activation.
 * Explicit authorization: change ONLY SellerProfile.avatarPath in cpsu_marketplace;
 * keep the two earlier unrelated migrations unapplied.
 * Builds a protected fresh backup, restores all existing data into a disposable
 * database, rehearses the exact migration + Prisma ledger resolution there,
 * then performs and verifies the same limited changes in local development.
 * Usage: bun scripts/seller-avatar-approved-dev-activation.ts --apply-approved-avatar-only
 * Never use against production or remote databases.
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, openSync, closeSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';

const NAME='20261117123000_seller_avatar_review';
const OTHER=['20261116220000_managed_student_content','20261116221000_pending_announcement_edits'];
const SOURCE='cpsu_marketplace';
const SQL_PATH=resolve(import.meta.dir,'../prisma/migrations/'+NAME+'/migration.sql');
const MIGRATION_HASH='9183574c569804e603371466d76d50477b0c7603ae3022bc73a8a54f2c0ac91f';
const EXPECTED_SQL='ALTER TABLE `SellerProfile`\n  ADD COLUMN `avatarPath` VARCHAR(255) NULL;';
const DUMP='C:\\xampp\\mysql\\bin\\mysqldump.exe';
const MYSQL='C:\\xampp\\mysql\\bin\\mysql.exe';
const bail=(ok:unknown,reason:string): asserts ok => { if(!ok) throw new Error('REFUSED: '+reason); };
const q=(x:string)=>{ if(!/^[a-zA-Z0-9_]+$/.test(x)) throw new Error('Unsafe table name');return '`'+x+'`'; };
type Row=Record<string,unknown>;
type Ledger={migration_name:string;finished_at:Date|null;rolled_back_at:Date|null;checksum:string};
if(process.argv.length!==3 || process.argv[2]!=='--apply-approved-avatar-only' || process.env.NODE_ENV==='production')
 throw new Error('REFUSED: exact --apply-approved-avatar-only flag and nonproduction mode required');
const sourceUrl=new URL(process.env.DATABASE_URL??'mysql://invalid/invalid');
bail(sourceUrl.protocol==='mysql:' && sourceUrl.hostname==='127.0.0.1' &&
 (!sourceUrl.port || sourceUrl.port==='3306') && decodeURIComponent(sourceUrl.pathname.slice(1))===SOURCE,
 'only loopback 127.0.0.1:3306/cpsu_marketplace is authorized');
bail(existsSync(DUMP) && existsSync(MYSQL),'XAMPP MySQL CLI required');
const srcSql=readFileSync(SQL_PATH,'utf8');
const sql=srcSql.split(/\r?\n/).filter(x=>!/^\s*--/.test(x)).join('\n').trim();
bail(sql===EXPECTED_SQL && createHash('sha256').update(srcSql).digest('hex')===MIGRATION_HASH,
 'seller avatar SQL/hash changed');
const scratch='cpsu_avatar_dev_gate_'+randomBytes(5).toString('hex');
const restoreUrl=new URL(sourceUrl);restoreUrl.pathname='/'+scratch;
const backupRoot=join(process.env.LOCALAPPDATA??join(homedir(),'AppData','Local'),
 'CPSU-Marketplace','backups');
const backupFolder=join(backupRoot,'seller-avatar-dev-approval-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(3).toString('hex'));
const backupFile=join(backupFolder,'pre-activation.sql');
const baseCli=['--protocol=TCP','--host=127.0.0.1','--port=3306',
 '--user='+decodeURIComponent(sourceUrl.username)];
const cliEnv={...process.env,MYSQL_PWD:decodeURIComponent(sourceUrl.password)};
const source=new PrismaClient({datasources:{db:{url:sourceUrl.toString()}}});
let restore:PrismaClient|undefined, created=false, devSqlApplied=false, devLedgerRecorded=false, backupReady=false;
let failure=false;
function run(executable:string,args:string[],options:{env?:Record<string,string|undefined>;input?:number;output?:number;cwd?:string}={}) {
 const result=spawnSync(executable,args,{env:options.env??cliEnv,cwd:options.cwd,
   stdio:[options.input??'ignore',options.output??'ignore','pipe'],encoding:'utf8',
   windowsHide:true,timeout:180000});
 if(result.error || result.status!==0)throw new Error('Command failed: '+executable.split('\\').at(-1)+' (exit '+String(result.status)+')');
}
function privateDir(folder:string) {
 mkdirSync(folder,{recursive:false});
 const user=userInfo().username;
 run('icacls.exe',[folder,'/inheritance:r','/grant:r',
   user+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F'],{env:process.env});
}
function normalize(row:Row) {
 return JSON.stringify(row,(_,v)=>typeof v==='bigint'?v.toString():
   v instanceof Uint8Array?Array.from(v):v);
}
async function target(prisma:PrismaClient,name:string) {
 const identity=await prisma.$queryRawUnsafe<{db:string}[]>('SELECT DATABASE() AS db');
 bail(identity[0]?.db===name,'connection database mismatch');
}
async function columns(prisma:PrismaClient) {
 return prisma.$queryRawUnsafe<{COLUMN_NAME:string;COLUMN_TYPE:string;IS_NULLABLE:string}[]>(
  "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='SellerProfile' AND COLUMN_NAME IN ('avatarPath','pendingAvatarPath')");
}
async function ledger(prisma:PrismaClient) {
 return prisma.$queryRawUnsafe<Ledger[]>(
  "SELECT migration_name, finished_at, rolled_back_at, checksum FROM _prisma_migrations WHERE migration_name IN ('"+NAME+"','"+OTHER[0]+"','"+OTHER[1]+"') ORDER BY migration_name");
}
async function tables(prisma:PrismaClient) {
 const result=await prisma.$queryRawUnsafe<{name:string}[]>(
   "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
 const names=result.map(x=>x.name);
 bail(names.some(x=>x.toLowerCase()==='sellerprofile') && names.includes('_prisma_migrations'),
  'expected source tables missing');
 names.forEach(q);
 return names;
}
async function snapshot(prisma:PrismaClient, names:string[],excludeAvatar=false) {
 const state:Record<string,{count:number;digest:string}>={};
 for(const name of names) {
  const col=await prisma.$queryRawUnsafe<{column_name:string}[]>(
   'SELECT COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',name);
  const selected=col.map(c=>c.column_name).filter(c=>!(excludeAvatar&&name.toLowerCase()==='sellerprofile'&&c==='avatarPath'));
  bail(selected.length>0,'table has no columns');
  const rows=await prisma.$queryRawUnsafe<Row[]>('SELECT '+selected.map(q).join(',')+' FROM '+q(name));
  const records=rows.map(normalize).sort();
  state[name]={count:rows.length,digest:createHash('sha256').update(JSON.stringify(records)).digest('hex')};
 }
 return state;
}
function same(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b);}
function withoutLedger<T>(snapshot:Record<string,T>) { const copy={...snapshot}; delete copy._prisma_migrations; return copy; }
function resolveApplied(url:URL) {
 const cwd=resolve(import.meta.dir,'..');
 // Invoke the locally pinned Prisma CLI without running "migrate deploy" or "migrate dev".
 run(process.execPath,['x','prisma','migrate','resolve','--applied',NAME],{
  env:{...process.env,DATABASE_URL:url.toString()},cwd,
 });
}
function verifyLedger(records:Ledger[],expected:number) {
 bail(records.length===expected,'unexpected migration ledger entries');
 const avatar=records.find(x=>x.migration_name===NAME);
 bail(!!avatar && avatar.finished_at!=null && avatar.rolled_back_at===null &&
  avatar.checksum===MIGRATION_HASH,'seller avatar migration ledger entry missing or incorrect');
 bail(OTHER.every(name=>!records.some(x=>x.migration_name===name)),'older unrelated migration was marked applied');
}
try {
 console.log('AVATAR_APPROVED_DEV_ACTIVATION: PRECHECK');
 await target(source,SOURCE);
 const originalTables=await tables(source);
 bail((await columns(source)).length===0,'avatar or pending avatar columns already exist');
 bail((await ledger(source)).length===0,'any of the three protected migrations already recorded');
 const before=await snapshot(source,originalTables);
 const exists=await source.$queryRawUnsafe<{SCHEMA_NAME:string}[]>(
  'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',scratch);
 bail(exists.length===0,'scratch schema name collision');
 privateDir(backupFolder);
 const output=openSync(backupFile,'wx',0o600);
 try{run(DUMP,[...baseCli,'--single-transaction','--quick','--hex-blob',
  '--skip-add-drop-table','--no-tablespaces','--default-character-set=utf8mb4',
  '--routines','--triggers','--events',SOURCE],{input:undefined,output});}
 finally{closeSync(output);}
 const backup=readFileSync(backupFile);
 const backupSql=backup.toString('utf8');
 bail(backup.length>0 && backupSql.includes('CREATE TABLE') &&
  !/(?:^|\n)\s*(USE|CREATE\s+DATABASE|DROP\s+DATABASE|DROP\s+TABLE)\s/mi.test(backupSql),
  'backup dump invalid or includes unapproved statements');
 const backupHash=createHash('sha256').update(backup).digest('hex');
 bail(createHash('sha256').update(readFileSync(backupFile)).digest('hex')===backupHash,'backup checksum failed');
 backupReady=true;
 bail(same(before,await snapshot(source,originalTables)),'source changed during backup');
 console.log(JSON.stringify({phase:'backup',status:'PASS',bytes:statSync(backupFile).size,
  sha256:backupHash,location:backupFile}));
 await source.$executeRawUnsafe('CREATE DATABASE '+q(scratch)+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
 created=true;
 const input=openSync(backupFile,'r');
 try{run(MYSQL,[...baseCli,'--default-character-set=utf8mb4','--database='+scratch],{input});}
 finally{closeSync(input);}
 restore=new PrismaClient({datasources:{db:{url:restoreUrl.toString()}}});
 await target(restore,scratch);
 bail(same(originalTables,await tables(restore)),'restore table inventory mismatch');
 bail(same(before,await snapshot(restore,originalTables)),'backup restore data hash mismatch');
 console.log(JSON.stringify({phase:'isolatedRestore',status:'PASS',tables:originalTables.length}));
 await restore.$executeRawUnsafe(sql);
 const restoredColumns=await columns(restore);
 bail(restoredColumns.length===1&&restoredColumns[0].COLUMN_NAME==='avatarPath'&&
   restoredColumns[0].COLUMN_TYPE.toLowerCase()==='varchar(255)'&&
   restoredColumns[0].IS_NULLABLE==='YES','isolated avatar column attributes mismatch');
 bail(same(before,await snapshot(restore,originalTables,true)),'isolated migration modified rows');
 resolveApplied(restoreUrl);
 verifyLedger(await ledger(restore),1);
 bail(same(withoutLedger(before),withoutLedger(await snapshot(restore,originalTables,true))),
  'ledger resolution modified existing application data');
 console.log(JSON.stringify({phase:'isolatedPrismaLedger',status:'PASS',
  avatarMarkedApplied:true,olderMigrationsUntouched:true}));
 // Strict source recheck immediately before first persistent development DDL.
 await target(source,SOURCE);
 bail((await columns(source)).length===0&&(await ledger(source)).length===0,
  'source schema changed while rehearsal ran');
 bail(same(before,await snapshot(source,originalTables)),'source data changed; refusing development migration');
 console.log('AVATAR_DEV_SCHEMA_CHANGE_BEGIN: exactly one reviewed additive SQL statement');
 await source.$executeRawUnsafe(sql);
 devSqlApplied=true;
 bail((await columns(source)).length===1,'new development column not detected');
 resolveApplied(sourceUrl);
 devLedgerRecorded=true;
 verifyLedger(await ledger(source),1);
 const postColumns=await columns(source);
 bail(postColumns.length===1&&postColumns[0].COLUMN_NAME==='avatarPath'&&
  postColumns[0].COLUMN_TYPE.toLowerCase()==='varchar(255)'&&postColumns[0].IS_NULLABLE==='YES',
  'development column shape mismatch');
 bail(same(withoutLedger(before),withoutLedger(await snapshot(source,originalTables,true))),
  'old development application data integrity mismatch');
 console.log(JSON.stringify({phase:'approvedDevelopmentMigration',status:'PASS',
  migration:NAME,backupRetained:true,otherMigrationsStillPending:true,
  developmentDataPreserved:true}));
} catch(e) {
 failure=true;
 console.error('AVATAR_APPROVED_DEV_ACTIVATION_FAILED: '+(e instanceof Error?e.message:'unknown error'));
 console.error(JSON.stringify({devSqlApplied,devLedgerRecorded,backupReady,
  action:'review state before retry; do not run broad migrations'}));
} finally {
 if(restore)await restore.$disconnect();
 if(created) {
  try {
   const exists=await source.$queryRawUnsafe<{SCHEMA_NAME:string}[]>(
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',scratch);
   if(exists.length) {
    await source.$executeRawUnsafe('DROP DATABASE '+q(scratch));
    console.log('CLEANUP: dropped only unique disposable test restore');
   }
  } catch {failure=true;console.error('CLEANUP FAILED: disposable restore schema must be inspected');}
 }
 await source.$disconnect();
 if(failure)process.exitCode=1;
}
