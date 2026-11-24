/**
 * Read-only in-memory HTTP check of the approved synthetic iPhone QA listing.
 * No listening ports, authentication sessions, push, file uploads or live DB writes.
 */
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
const source=new URL(process.env.DATABASE_URL ?? '');
if(process.env.NODE_ENV!=='test' || process.env.CPSU_IPHONE_QA_FIXTURES!=='approved' ||
  source.protocol!=='mysql:' || source.hostname!=='127.0.0.1' ||
  source.port!=='3306' || source.pathname!=='/cpsu_marketplace' ||
  source.search || source.hash) throw new Error('REFUSED: only isolated iPhone QA HTTP check.');
const test = new URL(source);test.pathname='/cpsu_marketplace_push_test';
process.env.DATABASE_URL=test.href;
process.env.MEDIA_STORAGE='local';
process.env.PUSH_DELIVERY_ENABLED='false';
process.env.PUSH_SUBSCRIPTIONS_ENABLED='false';
for(const key of ['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET','GOOGLE_DRIVE_REFRESH_TOKEN','GOOGLE_DRIVE_FOLDER_ID'])
  process.env[key]='';
const prisma=new PrismaClient({datasources:{db:{url:test.href}}});
try {
 const found=await prisma.$queryRawUnsafe<Array<{db:string}>>('SELECT DATABASE() AS db');
 if(found[0]?.db!=='cpsu_marketplace_push_test')throw new Error('Isolated DB identity mismatch');
 const {createApp}=await import('../src/app.js');
 const app=createApp();
 const health=await request(app).get('/health');
 if(health.status!==200 || !health.body?.ok)throw new Error('Health endpoint failed');
 const campuses=await request(app).get('/api/v1/campuses');
 if(campuses.status!==200 || !campuses.body.some((c:any)=>c.code==='CAUAYAN'))
   throw new Error('Cauayan synthetic campus not discoverable');
 const listing=await prisma.listing.findFirstOrThrow({
   where:{title:'CPSU iPhone QA — Synthetic Textbook (Not For Sale)'},
   select:{id:true}
 });
 const browse=await request(app).get('/api/v1/listings');
 if(browse.status!==200 || browse.body?.total!==1 ||
   browse.body?.items?.[0]?.id!==listing.id)
   throw new Error('Synthetic QA listing missing from public browse');
 const detail=await request(app).get('/api/v1/listings/'+listing.id);
 if(detail.status!==200 || detail.body?.id!==listing.id)
   throw new Error('Synthetic QA listing detail unavailable');
 const guest=await request(app).get('/api/v1/inquiries');
 if(guest.status!==401)throw new Error('Guest thread privacy regression');
 console.log('IPHONE_QA_READONLY_HTTP_PASS health=200, campus=200, browse=200, listing=200, unauthenticated_inbox=401');
 console.log('QA_LISTING_ID='+listing.id+' (synthetic only); no network listener or session created');
}finally{await prisma.$disconnect();}
