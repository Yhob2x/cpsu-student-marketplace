/** WP3 iPhone Gate C3: read-only isolated LAN QA schema inventory. No DDL/DML. */
import { PrismaClient } from '@prisma/client';

if(process.argv.length !== 3 || process.argv[2] !== '--read-only')
  throw new Error('WP3 iPhone schema audit requires --read-only.');
const raw=process.env.DATABASE_URL??'';
let source:URL;
try{ source=new URL(raw); }catch{throw new Error('Invalid local development database URL');}
if(process.env.NODE_ENV==='production' || source.protocol!=='mysql:' ||
  source.hostname!=='127.0.0.1' || source.port!=='3306' ||
  source.pathname!=='/cpsu_marketplace' || source.search || source.hash)
  throw new Error('REFUSED: only local dev reference 127.0.0.1:3306/cpsu_marketplace.');
const isolated=new URL(raw);
isolated.pathname='/cpsu_marketplace_push_test';
const prisma=new PrismaClient({datasources:{db:{url:isolated.toString()}}});
let problems=0;
try {
  const db=await prisma.$queryRawUnsafe<{db:string}[]>('SELECT DATABASE() AS db');
  if(db[0]?.db!=='cpsu_marketplace_push_test')
    throw new Error('REFUSED: isolated iPhone QA schema identity mismatch');
  const tables=await prisma.$queryRawUnsafe<{name:string}[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  const present=new Set(tables.map(t=>t.name.toLowerCase()));
  console.log('iPhone LAN QA schema: cpsu_marketplace_push_test; table count='+tables.length);
  if(!present.has('_prisma_migrations'))throw new Error('No Prisma migration history in test schema');
  const migrations=await prisma.$queryRawUnsafe<{
    migration_name:string;finished_at:Date|null;rolled_back_at:Date|null
  }[]>('SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations` ORDER BY migration_name');
  for(const m of migrations) {
    console.log('TEST MIGRATION '+m.migration_name+': '+(m.finished_at&&!m.rolled_back_at?'complete':'INCOMPLETE'));
    if(!m.finished_at || m.rolled_back_at)problems++;
  }
  if(!migrations.some(m=>m.migration_name==='20261116193000_wp3_transactions' &&
    m.finished_at&&!m.rolled_back_at)) {
    console.log('BLOCKER: WP3 transactions migration is not applied to isolated iPhone QA schema.');
    problems++;
  }
  const counts:Record<string,number>={};
  for(const tableName of ['User','Session','Listing','Transaction','TransactionStatusLog']){
    if(!present.has(tableName.toLowerCase())){console.log('MISSING TEST TABLE '+tableName);continue;}
    const rows=await prisma.$queryRawUnsafe<{n:bigint}[]>(
      'SELECT COUNT(*) AS n FROM `'+tableName+'`');
    counts[tableName]=Number(rows[0]?.n??0);
  }
  console.log('QA RECORD COUNTS ONLY '+JSON.stringify(counts));
  if(!counts.User) {
    console.log('BLOCKER: no synthetic test accounts; physical iPhone authenticated WP3 journeys cannot be tested.');
    problems++;
  }
  if(counts.User || counts.Session || counts.Transaction) {
    console.log('CAUTION: QA schema contains records; do not reset or seed without separate data review.');
  }
  console.log('WP3 IPHONE QA SCHEMA READ-ONLY '+(problems?'NOT READY; blockers='+problems:'READY'));
  if(problems)process.exitCode=2;
}finally{await prisma.$disconnect();}
