/**
 * Authenticated HTTP acceptance for activated local StoreFollow.
 * Synthetic users/store only, deleted after test.
 * Usage: bun scripts/store-follow-dev-http-acceptance.ts --local-synthetic-http
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { signAccess } from '../src/auth.js';
const assert = (value: unknown, msg: string): asserts value => {
  if (!value) throw new Error(msg);
};
assert(process.argv.length === 3 && process.argv[2] === '--local-synthetic-http' &&
  process.env.NODE_ENV !== 'production', 'REFUSED: exact local-only flag required');
const url = new URL(process.env.DATABASE_URL ?? 'mysql://invalid/invalid');
assert(url.protocol === 'mysql:' && url.hostname === '127.0.0.1' &&
  (!url.port || url.port === '3306') && url.pathname === '/cpsu_marketplace',
  'REFUSED: local development database required');
const db = new PrismaClient({datasources:{db:{url:url.toString()}}});
const base='http://127.0.0.1:4000/api/v1';
const users:number[]=[];
let storeId:number|null=null;
const marker=randomBytes(8).toString('hex');
const checks:string[]=[];
let passed=false;
const call=async(method:'GET'|'PUT'|'DELETE',path:string,token?:string)=>{
  const response=await fetch(base+path,{method,headers:token?{Authorization:'Bearer '+token}:{}});
  return {status:response.status,body:await response.json().catch(()=>({})) as any};
};
try {
  const identity=await db.$queryRawUnsafe<Array<{name:string}>>('SELECT DATABASE() AS name');
  assert(identity[0]?.name==='cpsu_marketplace','unexpected database');
  const followTable=await db.$queryRawUnsafe<Array<{name:string}>>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='StoreFollow'");
  assert(followTable.length===1,'StoreFollow table missing');
  const campus=await db.campus.findFirst({select:{id:true}});
  assert(campus,'no campus available for synthetic store');
  for(const role of ['owner','buyer','reviewer']){
    const user=await db.user.create({data:{
      email:'follow-e2e-'+role+'-'+marker+'@example.invalid',
      displayName:'Follow E2E '+role,passwordHash:'disabled-synthetic-only',
    },select:{id:true}});
    users.push(user.id);
  }
  const store=await db.sellerProfile.create({data:{
    ownerUserId:users[0],campusId:campus.id,storeName:'Follow E2E '+marker,
    description:'Temporary synthetic storefront, not a real student.',
    sellerType:'student',approvalStatus:'approved',
  },select:{id:true}});
  storeId=store.id;
  await db.userRole.create({data:{userId:users[2],campusId:campus.id,role:'campus_reviewer'}});
  const owner=signAccess(users[0]), buyer=signAccess(users[1]), reviewer=signAccess(users[2]);
  const path='/store-follows/'+store.id;
  const publicPath='/seller-profiles/'+store.id;
  const start=await call('GET',publicPath);
  assert(start.status===200&&start.body.follow?.available===true&&
    start.body.follow.count===0&&start.body.follow.isFollowing===false,
    'initial public follow state incorrect');
  checks.push('initial public store read');
  assert((await call('PUT',path)).status===401,'anonymous follow allowed');
  assert((await call('PUT',path,reviewer)).status===403,'staff follow allowed');
  assert((await call('PUT',path,owner)).status===400,'own-store follow allowed');
  assert((await call('PUT','/store-follows/999999999',buyer)).status===404,'missing store follow allowed');
  checks.push('guest/staff/owner/missing-store restrictions');
  const followed=await call('PUT',path,buyer);
  assert(followed.status===200&&followed.body.count===1&&followed.body.isFollowing===true,
    'first follow failed');
  const again=await call('PUT',path,buyer);
  assert(again.status===200&&again.body.count===1,'duplicate follow increased count');
  const mine=await call('GET',publicPath,buyer);
  assert(mine.status===200&&mine.body.follow?.count===1&&
    mine.body.follow.isFollowing===true,'authenticated viewer follow state incorrect');
  const guest=await call('GET',publicPath);
  assert(guest.status===200&&guest.body.follow?.count===1&&
    guest.body.follow.isFollowing===false,'guest personal follow state leaked');
  checks.push('follow, idempotency, viewer state and count privacy');
  const unfollow=await call('DELETE',path,buyer);
  assert(unfollow.status===200&&unfollow.body.count===0&&unfollow.body.isFollowing===false,
    'unfollow failed');
  const duplicateUnfollow=await call('DELETE',path,buyer);
  assert(duplicateUnfollow.status===200&&duplicateUnfollow.body.count===0,
    'repeat unfollow failed');
  const final=await call('GET',publicPath,buyer);
  assert(final.status===200&&final.body.follow?.count===0&&!final.body.follow?.isFollowing,
    'final state not synchronized');
  checks.push('unfollow, repeat unfollow and final read');
  passed=true;
  console.log(JSON.stringify({result:'PASS',base:'127.0.0.1:4000',authenticatedHTTP:true,
    checks,syntheticUsersOnly:true}));
} catch(error){
  console.error('STORE_FOLLOW_DEV_HTTP_ACCEPTANCE_FAILED: '+
    (error instanceof Error?error.message:'unknown'));
} finally {
  try {
    if(storeId!==null){
      await db.storeFollow.deleteMany({where:{sellerProfileId:storeId}});
      await db.sellerProfile.deleteMany({where:{id:storeId,ownerUserId:users[0]}});
    }
    if(users.length){
      await db.userRole.deleteMany({where:{userId:{in:users}}});
      await db.user.deleteMany({where:{id:{in:users}}});
    }
    const leftovers=await db.user.count({where:{email:{contains:marker}}});
    assert(leftovers===0,'synthetic accounts remain');
    if(storeId!==null) assert(await db.sellerProfile.count({where:{id:storeId}})===0,
      'synthetic store remains');
    console.log('SYNTHETIC_CLEANUP: PASS; synthetic identities, store and follows removed.');
  } catch(error){
    passed=false;
    console.error('SYNTHETIC_CLEANUP_FAILED: '+(error instanceof Error?error.message:'unknown'));
  } finally {
    await db.$disconnect();
  }
  if(!passed) process.exitCode=1;
}
