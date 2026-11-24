/**
 * Authenticated seller photo HTTP acceptance against disposable synthetic entities
 * in a dedicated, existing local QA database. Never uses live user credentials.
 *
 * bun test/seller-avatar-isolated-http.ts --isolated-synthetic-http
 */
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

if (process.argv.length !== 3 || process.argv[2] !== '--isolated-synthetic-http')
  throw new Error('REFUSED: explicit --isolated-synthetic-http required');
const source = new URL(process.env.DATABASE_URL ?? 'mysql://invalid/invalid');
if (source.protocol !== 'mysql:' || source.hostname !== '127.0.0.1' ||
    !['3306',''].includes(source.port) || decodeURIComponent(source.pathname.slice(1)) !== 'cpsu_marketplace' ||
    process.env.NODE_ENV === 'production')
  throw new Error('REFUSED: only local CPSU source identity permitted');
const qa = new URL(source); qa.pathname = '/cpsu_marketplace_push_test';
const dir = await mkdtemp(join(tmpdir(),'cpsu-avatar-http-synthetic-'));
process.env.DATABASE_URL = qa.href;
process.env.NODE_ENV = 'test';
process.env.MEDIA_STORAGE = 'local';
process.env.UPLOAD_DIR = dir;
process.env.COOKIE_SECURE = 'false';
process.env.BIND_HOST = '127.0.0.1';
process.env.PUSH_SUBSCRIPTIONS_ENABLED = 'false';
process.env.PUSH_DELIVERY_ENABLED = 'false';
for (const key of ['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REFRESH_TOKEN','GOOGLE_DRIVE_FOLDER_ID']) process.env[key]='';

const [{ createApp }, { prisma }, { hashPassword }, { default: request }] = await Promise.all([
  import('../src/app.js'), import('../src/db.js'), import('../src/auth.js'), import('supertest'),
]);
const assert = (ok:unknown,msg:string): asserts ok => {if(!ok) throw new Error('FAIL: '+msg)};
const app = createApp();
let ownerId: number | null = null, buyerId: number | null = null, storeId: number | null = null;
let passed = false;
const password = randomBytes(24).toString('base64url');
const email = 'avatar-synthetic-owner-'+randomBytes(8).toString('hex')+'@example.invalid';
const buyerEmail = 'avatar-synthetic-buyer-'+randomBytes(8).toString('hex')+'@example.invalid';
try {
  const identity = await prisma.$queryRawUnsafe<{ db:string }[]>('SELECT DATABASE() AS db');
  assert(identity[0]?.db === 'cpsu_marketplace_push_test','QA database identity');
  const campus = await prisma.campus.findFirst({ where:{active:true}, select:{id:true} });
  assert(Boolean(campus),'active synthetic QA campus exists');
  // All newly created records are test-only and are deleted in finally.
  const [owner,buyer] = await prisma.$transaction(async tx => {
    const owner = await tx.user.create({data:{
      email,displayName:'Disposable Avatar Safety Owner',
      passwordHash:await hashPassword(password),
      affiliations:{create:{campusId:campus!.id,verificationStatus:'verified',verifiedAt:new Date()}},
    },select:{id:true}});
    const buyer = await tx.user.create({data:{
      email:buyerEmail,displayName:'Disposable Avatar Safety Buyer',
      passwordHash:await hashPassword(password),
      affiliations:{create:{campusId:campus!.id,verificationStatus:'verified',verifiedAt:new Date()}},
    },select:{id:true}});
    return [owner,buyer];
  });
  ownerId=owner.id; buyerId=buyer.id;
  const store=await prisma.sellerProfile.create({data:{
    ownerUserId:ownerId,campusId:campus!.id,
    storeName:'Disposable Synthetic Avatar Test Store',
    description:'Synthetic isolated NSFW upload verification store, not a real seller.',
    sellerType:'student',approvalStatus:'approved',
  },select:{id:true,avatarPath:true}});
  storeId=store.id;
  assert(store.avatarPath===null,'new synthetic store starts without avatar');

  const guest=await request(app).post('/api/v1/seller/store/avatar');
  assert(guest.status===401,'guests cannot upload');
  const login=await request(app).post('/api/v1/auth/login').send({email,password});
  const buyerLogin=await request(app).post('/api/v1/auth/login').send({email:buyerEmail,password});
  assert(login.status===200 && buyerLogin.status===200 &&
    typeof login.body.accessToken==='string','real HTTP synthetic logins');
  const auth={Authorization:'Bearer '+login.body.accessToken};
  const unauthorized=await request(app).post('/api/v1/seller/store/avatar')
    .set({Authorization:'Bearer '+buyerLogin.body.accessToken});
  assert(unauthorized.status===403,'buyer cannot upload seller avatar');
  const invalid=await request(app).post('/api/v1/seller/store/avatar').set(auth)
    .attach('image',Buffer.from('not an image'),{filename:'bad.png',contentType:'image/png'});
  assert(invalid.status===400,'invalid image bytes are rejected');
  assert((await prisma.sellerProfile.findUnique({where:{id:store.id},select:{avatarPath:true}}))?.avatarPath===null,
    'invalid inputs leave original picture unchanged');

  const synthetic=await sharp({create:{width:512,height:512,channels:3,background:'#e8eadf'}})
    .png().toBuffer();
  const first=await request(app).post('/api/v1/seller/store/avatar').set(auth)
    .attach('image',synthetic,{filename:'synthetic-safe.png',contentType:'image/png'});
  assert(first.status===200 && /^\/api\/v1\/media\/seller-avatar\/\d+\?v=[a-f0-9]{16}$/.test(first.body.avatarUrl),
    'safe upload publishes immediately and version is valid (status '+first.status+')');
  const firstRef=(await prisma.sellerProfile.findUnique({where:{id:store.id},select:{avatarPath:true}}))?.avatarPath;
  assert(Boolean(firstRef),'first uploaded avatar stored in isolated DB');
  const image=await request(app).get(first.body.avatarUrl);
  assert(image.status===200 && /image\/webp/.test(image.headers['content-type']||''),
    'guest can retrieve sanitized WebP');
  assert(image.headers['cache-control']==='private, no-store','media cache is private no-store');
  const replacement=await request(app).post('/api/v1/seller/store/avatar').set(auth)
    .attach('image',synthetic,{filename:'synthetic-replacement.png',contentType:'image/png'});
  assert(replacement.status===200 && replacement.body.avatarUrl!==first.body.avatarUrl,
    'replacing an avatar changes URL version');
  const secondRef=(await prisma.sellerProfile.findUnique({where:{id:store.id},select:{avatarPath:true}}))?.avatarPath;
  assert(Boolean(secondRef) && secondRef!==firstRef,'replacement updates DB ref');
  assert(!(await readdir(dir)).includes(firstRef!),'old local image removed after successful replacement');
  const publicStore=await request(app).get('/api/v1/seller-profiles/'+store.id);
  assert(publicStore.status===200 && publicStore.body.avatarUrl===replacement.body.avatarUrl,
    'public seller page displays replacement URL');
  const secondImage=await request(app).get(replacement.body.avatarUrl);
  assert(secondImage.status===200,'guest can retrieve replacement image');
  const remove=await request(app).delete('/api/v1/seller/store/avatar').set(auth);
  assert(remove.status===204,'authenticated seller removes avatar');
  const removed=(await prisma.sellerProfile.findUnique({where:{id:store.id},select:{avatarPath:true}}))?.avatarPath;
  assert(removed===null,'seller profile reference cleared');
  assert((await readdir(dir)).length===0,'uploaded local media cleaned up');
  const finalPublic=await request(app).get('/api/v1/seller-profiles/'+store.id);
  assert(finalPublic.body.avatarUrl===null,'public store reverts to initials');
  const audits=await prisma.auditLog.groupBy({
    by:['action'],where:{actorUserId:ownerId,targetType:'seller_profile',targetId:store.id,
      action:{in:['seller.avatar_published','seller.avatar_removed']}},_count:{_all:true},
  });
  assert(audits.find(a=>a.action==='seller.avatar_published')?._count._all===2 &&
    audits.find(a=>a.action==='seller.avatar_removed')?._count._all===1,
    'success and removal are audited');
  passed=true;
  console.log(JSON.stringify({suite:'SELLER_AVATAR_AUTHENTICATED_ISOLATED_HTTP',status:'PASS',
    checks:12,model:'real NSFWJS model on synthetic safe image',store:'disposable synthetic only',
    googleDriveAccess:false,developmentDataChanged:false}));
} finally {
  const ids=[ownerId,buyerId].filter((x):x is number=>x!==null);
  if(ownerId!==null)await prisma.auditLog.deleteMany({where:{actorUserId:ownerId}});
  if(ids.length)await prisma.session.deleteMany({where:{userId:{in:ids}}});
  if(storeId!==null)await prisma.sellerProfile.delete({where:{id:storeId}});
  if(ids.length)await prisma.affiliation.deleteMany({where:{userId:{in:ids}}});
  if(ids.length)await prisma.user.deleteMany({where:{id:{in:ids}}});
  await prisma.$disconnect();
  await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});
  console.log(JSON.stringify({cleanup:'deleted disposable synthetic seller, buyer, sessions, audits and photos',passed}));
}
