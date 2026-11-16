/** WP3 Gate B read-only exact-target DB-writer check. Never prints secrets or user records. */
import { PrismaClient } from '@prisma/client';
const raw=process.env.DATABASE_URL ?? '';
let u:URL;
try {u=new URL(raw);}catch{throw new Error('Invalid DB identity');}
if (process.env.NODE_ENV === 'production' || u.protocol !== 'mysql:' ||
    u.hostname !== '127.0.0.1' || u.port !== '3306' ||
    u.pathname !== '/cpsu_marketplace' || u.search || u.hash)
  throw new Error('Not exact approved local development target.');
const db=new PrismaClient({datasources:{db:{url:raw}}});
try {
  const name=await db.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
  if (name[0]?.name!=='cpsu_marketplace') throw new Error('DB selected wrong target.');
  const c=await db.$queryRawUnsafe<{n:bigint}[]>(
    "SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE DB = 'cpsu_marketplace' AND ID <> CONNECTION_ID()");
  const t=await db.$queryRawUnsafe<{n:bigint}[]>(
    "SELECT COUNT(*) AS n FROM information_schema.INNODB_TRX WHERE trx_mysql_thread_id <> CONNECTION_ID()");
  console.log('READ-ONLY TARGET: 127.0.0.1:3306/cpsu_marketplace');
  console.log('OTHER_TARGET_CONNECTIONS='+Number(c[0]?.n??0));
  console.log('OTHER_ACTIVE_TRANSACTIONS='+Number(t[0]?.n??0));
  if(Number(c[0]?.n??0)!==0 || Number(t[0]?.n??0)!==0) process.exitCode=2;
}finally{await db.$disconnect();}
