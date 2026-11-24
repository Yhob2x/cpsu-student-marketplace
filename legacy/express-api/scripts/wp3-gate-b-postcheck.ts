/** Independent READ-ONLY post-activation inspection of local WP3 development. */
import { PrismaClient } from '@prisma/client';
import { EXPECTED_APPLIED, EXPECTED_MIGRATIONS, EXPECTED_PENDING } from './wp3-gate-b-readonly-policy.js';
import { WP3_MIGRATION } from './wp3-restore-safety.js';
if(process.argv.length!==3 || process.argv[2]!=='--read-only')
  throw new Error('Only --read-only permitted.');
let url:URL;
try {url=new URL(process.env.DATABASE_URL??'');}catch{throw new Error('Invalid URL');}
if(process.env.NODE_ENV==='production' || url.protocol!=='mysql:' ||
   url.hostname!=='127.0.0.1' || url.port!=='3306' ||
   url.pathname!=='/cpsu_marketplace' || url.search || url.hash)
  throw new Error('Only exact loopback development database allowed.');
const db=new PrismaClient();
try{
  const q=await db.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
  if(q[0]?.name!=='cpsu_marketplace')throw new Error('Wrong connection');
  const migrations=await db.$queryRawUnsafe<{
    migration_name:string;checksum:string;finished_at:Date|null;rolled_back_at:Date|null
  }[]>('SELECT migration_name,checksum,finished_at,rolled_back_at FROM `_prisma_migrations`');
  const expected=[...EXPECTED_APPLIED,WP3_MIGRATION];
  const applied=migrations.map(x=>x.migration_name).sort();
  if(applied.join('|')!==expected.slice().sort().join('|') ||
    migrations.some(m=>!m.finished_at || m.rolled_back_at ||
      m.checksum.toUpperCase()!==EXPECTED_MIGRATIONS[m.migration_name]))
    throw new Error('Post-WP3 history drift');
  const tableRecords=await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  const tableNames=new Set(tableRecords.map(x=>x.name.toLowerCase()));
  if(tableNames.size!==24 || !tableNames.has('transaction') || !tableNames.has('transactionstatuslog'))
    throw new Error('Unexpected post-WP3 tables');
  const requiredFks=[
    'Listing_reservationTransactionId_fkey',
    'Transaction_inquiryThreadId_fkey','Transaction_listingId_fkey',
    'Transaction_buyerUserId_fkey','Transaction_sellerUserId_fkey',
    'TransactionStatusLog_transactionId_fkey','TransactionStatusLog_actorUserId_fkey',
  ];
  const fks=await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
  const present=new Set(fks.map(x=>x.name.toLowerCase()));
  if(requiredFks.some(x=>!present.has(x.toLowerCase())))throw new Error('WP3 foreign keys missing');
  const [listings,transactions,history]=await Promise.all([
    db.listing.count(),db.transaction.count(),db.transactionStatusLog.count(),
  ]);
  console.log('READ-ONLY CURRENT AGGREGATES: listings='+listings+' transactions='+transactions+' status_logs='+history);
  const reserved=await db.$queryRawUnsafe<{n:bigint}[]>(
    'SELECT COUNT(*) AS n FROM `Listing` WHERE reservationTransactionId IS NOT NULL');
  console.log('READ-ONLY CURRENT RESERVATION COUNT: '+Number(reserved[0]?.n??0));
  if(Number(reserved[0]?.n??0)!==0)throw new Error('Unexpected WP3 reservation; inspect current activity.');
  if(listings!==22 || transactions!==0 || history!==0)
    throw new Error('WP3 baseline row counts changed since original Gate B; review current activity before concluding integrity.');
  console.log('POST-WP3 READ-ONLY PASS: six applied migrations, exactly WP3 added.');
  console.log('Preserved listings='+listings+'; transaction rows='+transactions+
    '; status log rows='+history+'; unauthorized reservations=0.');
  console.log('All seven WP3 FKs present; 24 database tables; unrelated pending migrations: '+EXPECTED_PENDING.slice(1).join(', '));
  console.log('Prisma Client WP3 model read operations: PASS. No data changes.');
}catch(e){
  console.error('POST-WP3 READ-ONLY FAIL: '+(e instanceof Error?e.message:'unknown'));
  process.exitCode=1;
}finally{await db.$disconnect();}
