/**
 * Store chat: authenticated synthetic HTTP acceptance for existing inquiry pipeline.
 * Authorized local development only; creates and deletes synthetic rows.
 * Run from apps/api with bun scripts/store-chat-dev-http-acceptance.ts --local-synthetic-chat
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { signAccess } from '../src/auth.js';
const ok=(truth:unknown,reason:string):asserts truth=>{
  if(!truth) throw new Error(reason);
};
ok(process.argv.length===3&&process.argv[2]==='--local-synthetic-chat'&&
  process.env.NODE_ENV!=='production','REFUSED: explicit local-only synthetic acceptance required');
const url=new URL(process.env.DATABASE_URL??'mysql://invalid/invalid');
ok(url.protocol==='mysql:'&&url.hostname==='127.0.0.1'&&
  (!url.port||url.port==='3306')&&url.pathname==='/cpsu_marketplace',
  'REFUSED: unexpected database');
const db=new PrismaClient({datasources:{db:{url:url.toString()}}});
const base='http://127.0.0.1:4000/api/v1';
const marker=randomBytes(7).toString('hex');
const users:number[]=[];
let storeId:number|null=null, listingId:number|null=null, threadId:number|null=null;
let passed=false;
const call=async(method:'GET'|'POST',path:string,token?:string,body?:unknown)=>{
  const response=await fetch(base+path,{
    method,headers:{"Content-Type":"application/json",...(token?{Authorization:'Bearer '+token}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
  return {status:response.status,body:await response.json().catch(()=>({})) as any};
};
try{
  const dbName=await db.$queryRawUnsafe<Array<{name:string}>>('SELECT DATABASE() AS name');
  ok(dbName[0]?.name==='cpsu_marketplace','local database identity changed');
  const campus=await db.campus.findFirst({select:{id:true}});
  const category=await db.category.findFirst({where:{listingType:'physical_product'},select:{id:true}});
  ok(campus&&category,'missing campus or category for safe synthetic fixture');
  for(const who of ['owner','buyer']){
    const u=await db.user.create({data:{
      email:'store-chat-qa-'+who+'-'+marker+'@example.invalid',
      displayName:'Store Chat Synthetic '+who,passwordHash:'disabled-test',
    },select:{id:true}});
    users.push(u.id);
  }
  const s=await db.sellerProfile.create({data:{
    ownerUserId:users[0],campusId:campus.id,storeName:'Store Chat QA '+marker,
    description:'Temporary synthetic test store, deleted after test.',
    approvalStatus:'approved',sellerType:'student',
  },select:{id:true}});
  storeId=s.id;
  const listing=await db.listing.create({data:{
    sellerProfileId:s.id,campusId:campus.id,categoryId:category.id,
    type:'physical_product',title:'Store Chat Synthetic Listing '+marker,
    description:'Temporary local test-only listing',price:12,
    status:'published',availabilityState:'available',
  },select:{id:true}});
  listingId=listing.id;
  const ownerToken=signAccess(users[0]), buyerToken=signAccess(users[1]);
  const initialStore=await call('GET','/seller-profiles/'+s.id,buyerToken);
  ok(initialStore.status===200&&initialStore.body.listings?.some((x:any)=>x.id===listing.id),
    'published store listing unavailable for store chat');
  const msg='Synthetic inquiry about '+marker;
  ok((await call('POST','/inquiries',undefined,{listingId:listing.id,body:msg})).status===401,
    'anonymous store chat was accepted');
  ok((await call('POST','/inquiries',ownerToken,{listingId:listing.id,body:msg})).status===400,
    'store owner was able to chat with own listing');
  const created=await call('POST','/inquiries',buyerToken,{listingId:listing.id,body:msg});
  ok(created.status===201&&Number.isInteger(created.body.id),'authenticated store inquiry failed');
  threadId=created.body.id;
  const sellerView=await call('GET','/inquiries/'+threadId+'/messages',ownerToken);
  ok(sellerView.status===200&&sellerView.body.thread?.listingId===listing.id&&
    sellerView.body.messages?.some((m:any)=>m.body===msg),'seller inbox did not receive buyer message');
  const buyerView=await call('GET','/inquiries/'+threadId+'/messages',buyerToken);
  ok(buyerView.status===200&&buyerView.body.messages?.some((m:any)=>m.body===msg&&m.mine),
    'buyer conversation history missing');
  const notice=await db.notification.count({where:{userId:users[0],type:'inquiry.new'}});
  ok(notice===1,'seller did not receive an inquiry notification');
  console.log(JSON.stringify({result:'PASS',checks:[
    'public store lists only published available test item',
    'guest and owner cannot create listing inquiry',
    'student creates inquiry and seller receives message',
    'buyer sees original message in existing inbox',
    'seller receives standard in-app notification',
  ],auth:true,syntheticOnly:true}));
  passed=true;
}catch(error){
  console.error('STORE_CHAT_LOCAL_HTTP_FAILED: '+
    (error instanceof Error?error.message:'unexpected error'));
}finally{
  try{
    if(users.length){
      await db.notification.deleteMany({where:{userId:{in:users}}});
    }
    if(threadId!==null){
      await db.inquiryMessage.deleteMany({where:{threadId}});
      await db.inquiryThread.deleteMany({where:{id:threadId}});
    }
    if(listingId!==null) await db.listing.deleteMany({where:{id:listingId}});
    if(storeId!==null) await db.sellerProfile.deleteMany({where:{id:storeId}});
    if(users.length) await db.user.deleteMany({where:{id:{in:users}}});
    ok(await db.user.count({where:{email:{contains:marker}}})===0,'synthetic users left behind');
    console.log('SYNTHETIC_STORE_CHAT_CLEANUP: PASS; no test users, messages, listings or stores remain.');
  }catch(error){
    passed=false;
    console.error('SYNTHETIC_STORE_CHAT_CLEANUP_FAILED: '+(error instanceof Error?error.message:'unknown'));
  }finally{await db.$disconnect();}
  if(!passed)process.exitCode=1;
}
