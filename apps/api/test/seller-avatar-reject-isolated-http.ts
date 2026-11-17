/**
 * Opt-in isolated authenticated HTTP rejection test using synthetic policy decisions
 * (no real sexual images). Cannot alter local development or non-QA records.
 * bun test/seller-avatar-reject-isolated-http.ts --simulated-screening-failures
 */
import { mock } from 'bun:test';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
if(process.argv.length!==3 || process.argv[2]!=='--simulated-screening-failures')
  throw new Error('REFUSED: explicit --simulated-screening-failures required');
const source=new URL(process.env.DATABASE_URL??'mysql://invalid/invalid');
if(source.protocol!=='mysql:'||source.hostname!=='127.0.0.1'||
  !['','3306'].includes(source.port)||
  decodeURIComponent(source.pathname.slice(1))!=='cpsu_marketplace'||
  process.env.NODE_ENV==='production')
  throw new Error('REFUSED: source database must be local CPSU development identity');
const url=new URL(source);url.pathname='/cpsu_marketplace_push_test';
const dir=await mkdtemp(join(tmpdir(),'cpsu-nsfw-reject-http-'));
process.env.DATABASE_URL=url.href;
process.env.NODE_ENV='test';
process.env.MEDIA_STORAGE='local';
process.env.UPLOAD_DIR=dir;
process.env.COOKIE_SECURE='false';
process.env.BIND_HOST='127.0.0.1';
process.env.PUSH_SUBSCRIPTIONS_ENABLED='false';
process.env.PUSH_DELIVERY_ENABLED='false';
for(const k of ['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET',
 'GOOGLE_DRIVE_REFRESH_TOKEN','GOOGLE_DRIVE_FOLDER_ID'])process.env[k]='';

const {HttpError}=await import('../src/http.js');
type Failure='explicit'|'uncertain'|'unavailable';
let simulated:Failure='explicit';
// Intercept only the local scanner module for a TEST-ONLY failure-path check.
// The production/server source never contains any classifier-bypass toggle.
mock.module('../src/seller-avatar-screening.js',()=>({
  screenSellerAvatar: async()=>{
    if(simulated==='explicit')throw new HttpError(422,'avatar_explicit_content','Test explicit');
    if(simulated==='uncertain')throw new HttpError(422,'avatar_uncertain_content','Test uncertain');
    throw new HttpError(503,'avatar_screening_unavailable','Test unavailable');
  },
}));
const [{createApp},{prisma},{hashPassword},{default:request}]=await Promise.all([
 import('../src/app.js'),import('../src/db.js'),import('../src/auth.js'),import('supertest'),
]);
const app=createApp();
const assert=(value:unknown,label:string):asserts value=>{
  if(!value)throw new Error('FAIL: '+label);
};
let userId:number|null=null,storeId:number|null=null,passed=false;
const email='avatar-reject-qa-'+randomBytes(8).toString('hex')+'@example.invalid';
const password=randomBytes(24).toString('base64url');
const baseline='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
try {
 const db=await prisma.$queryRawUnsafe<{db:string}[]>('SELECT DATABASE() AS db');
 assert(db[0]?.db==='cpsu_marketplace_push_test','isolated QA schema');
 const campus=await prisma.campus.findFirst({where:{active:true},select:{id:true}});
 assert(Boolean(campus),'QA campus');
 const user=await prisma.user.create({data:{
  email,displayName:'Disposable Rejected Avatar Seller',passwordHash:await hashPassword(password),
  affiliations:{create:{campusId:campus!.id,verificationStatus:'verified',verifiedAt:new Date()}},
 },select:{id:true}});
 userId=user.id;
 const store=await prisma.sellerProfile.create({data:{
  ownerUserId:userId,campusId:campus!.id,
  storeName:'Synthetic Safe Existing Store',
  description:'Temporary test store for blocked avatar replacements.',
  sellerType:'student',approvalStatus:'approved',
  avatarPath:baseline,
 },select:{id:true}});
 storeId=store.id;
 const baselineBytes=await sharp({create:{width:128,height:128,channels:3,background:'#e8eadf'}}).webp().toBuffer();
 await writeFile(join(dir,baseline),baselineBytes);
 const login=await request(app).post('/api/v1/auth/login').send({email,password});
 assert(login.status===200 && !!login.body.accessToken,'seller login successful');
 const auth={Authorization:'Bearer '+login.body.accessToken};
 const image=await sharp({create:{width:300,height:300,channels:3,background:'#d6d9c9'}}).png().toBuffer();
 for(const scenario of ['explicit','uncertain','unavailable'] as const){
  simulated=scenario;
  const response=await request(app).post('/api/v1/seller/store/avatar').set(auth)
    .attach('image',image,{filename:'synthetic.png',contentType:'image/png'});
  const expected=scenario==='unavailable'?503:422;
  const code=scenario==='explicit'?'avatar_explicit_content':
    scenario==='uncertain'?'avatar_uncertain_content':'avatar_screening_unavailable';
  assert(response.status===expected,scenario+' HTTP status expected '+expected+' got '+response.status);
  assert(response.body?.error?.code===code,scenario+' clear error code');
  const existing=await prisma.sellerProfile.findUnique({where:{id:store.id},select:{avatarPath:true}});
  assert(existing?.avatarPath===baseline,scenario+' preserved prior public picture');
  const remaining=await readdir(dir);
  assert(remaining.length===1 && remaining[0]===baseline,
    scenario+' removed rejected normalized image');
 }
 const actions=await prisma.auditLog.count({where:{
  targetType:'seller_profile',targetId:store.id,action:'seller.avatar_published',
 }});
 assert(actions===0,'no publication audit for blocked uploads');
 passed=true;
 console.log(JSON.stringify({suite:'SELLER_AVATAR_REJECTED_HTTP',status:'PASS',
  simulatedDecisions:['explicit','uncertain','unavailable'],realExplicitImagesUsed:false,
  existingPhotoPreserved:true,rejectedImagesDeleted:true,otherDataTouched:false,
  database:'isolated synthetic QA'}));
} finally {
 if(userId!==null)await prisma.auditLog.deleteMany({where:{actorUserId:userId}});
 if(userId!==null)await prisma.session.deleteMany({where:{userId}});
 if(storeId!==null)await prisma.sellerProfile.delete({where:{id:storeId}});
 if(userId!==null)await prisma.affiliation.deleteMany({where:{userId}});
 if(userId!==null)await prisma.user.delete({where:{id:userId}});
 await prisma.$disconnect();
 await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});
 mock.restore();
 console.log(JSON.stringify({cleanup:'disposable test account/media deleted',passed}));
}
