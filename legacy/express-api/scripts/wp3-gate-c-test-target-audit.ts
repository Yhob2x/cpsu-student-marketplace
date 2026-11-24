/**
 * Gate C read-only audit. Only the existing LOCAL cpsu_marketplace_test database
 * is inspected. No fixture reset, schema creation/migration or data modifications.
 */
import { PrismaClient } from '@prisma/client';
const raw=process.env.DATABASE_URL??'';
let u:URL;
try{u=new URL(raw);}catch{throw new Error('Missing valid local database connection');}
if(process.env.NODE_ENV==='production'||u.protocol!=='mysql:' ||
  u.hostname!=='127.0.0.1'||u.port!=='3306'||u.pathname!=='/cpsu_marketplace' ||
  u.search || u.hash)throw new Error('Refusing nonapproved development source.');
const testUrl=new URL(raw);
testUrl.pathname='/cpsu_marketplace_test';
const client=new PrismaClient({datasources:{db:{url:raw}}});
try{
  const schemas=await client.$queryRawUnsafe<{schemaName:string}[]>(
    "SELECT SCHEMA_NAME AS schemaName FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='cpsu_marketplace_test'");
  if(!schemas.length){console.log('GATE C TEST DB: does not exist; no fixture contents to overwrite.');}
  else{
    // Read-only queries use a separate connection to the exact test database.
    const testing=new PrismaClient({datasources:{db:{url:testUrl.toString()}}});
    try{
      const db=await testing.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
      if(db[0]?.name!=='cpsu_marketplace_test')throw new Error('Wrong test schema.');
      const tables=await testing.$queryRawUnsafe<{name:string}[]>(
        "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
      const names=new Set(tables.map(x=>x.name.toLowerCase()));
      console.log('GATE C TEST DB exists; table count='+names.size);
      let nonHistoryRows=0;
      for(const tableName of names){
        if(tableName==='_prisma_migrations')continue;
        if(!/^[a-z_][a-z0-9_]*$/.test(tableName))throw new Error('Unrecognized test table identifier.');
        const rows=await testing.$queryRawUnsafe<{n:bigint}[]>(
          'SELECT COUNT(*) AS n FROM `'+tableName+'`');
        nonHistoryRows+=Number(rows[0]?.n??0);
      }
      console.log('TEST non-migration-history row count='+nonHistoryRows);
      if(nonHistoryRows!==0)throw new Error('STOP: isolated test schema contains rows; automatic fixture reset not approved.');
      if(names.has('user')){
        const accounts=await testing.$queryRawUnsafe<{total:bigint;unexpected:bigint}[]>(
          "SELECT COUNT(*) AS total, SUM(CASE WHEN email NOT LIKE '%@stage1.invalid' THEN 1 ELSE 0 END) AS unexpected FROM `User`");
        console.log('Existing test-only accounts='+Number(accounts[0]?.total??0)+
          '; accounts outside approved @stage1.invalid fixtures='+Number(accounts[0]?.unexpected??0));
        if(Number(accounts[0]?.unexpected??0)>0)throw new Error('STOP: unknown users in test schema; fixture reset unsafe.');
      }
      if(names.has('_prisma_migrations')){
        const migrations=await testing.$queryRawUnsafe<{name:string;complete:number}[]>(
          'SELECT migration_name AS name, (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS complete FROM `_prisma_migrations` ORDER BY migration_name');
        console.log('TEST migration records='+migrations.length);
        for(const m of migrations)console.log('MIGRATION '+m.name+' completed='+Boolean(m.complete));
        if(migrations.some(x=>!x.complete))throw new Error('STOP: partial test migration history.');
      }
    }finally{await testing.$disconnect();}
  }
  console.log('GATE C AUDIT READ-ONLY COMPLETE.');
}finally{await client.$disconnect();}
