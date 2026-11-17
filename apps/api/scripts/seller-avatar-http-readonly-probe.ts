/**
 * Read-only localhost HTTP probe; prints only status/type/hash, never image bytes,
 * storage references, seller names or identifiers.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { sellerAvatarUrl } from '../src/seller-avatar-url.js';
const source = new URL(process.env.DATABASE_URL || '');
if (source.protocol !== 'mysql:' || source.hostname !== '127.0.0.1' ||
  decodeURIComponent(source.pathname.slice(1)) !== 'cpsu_marketplace')
  throw new Error('REFUSED: local development database only');
const db = new PrismaClient();
try {
 const store = await db.sellerProfile.findFirst({
  where:{avatarPath:{not:null},approvalStatus:'approved',owner:{status:'active'}},
  select:{id:true,avatarPath:true}
 });
 if(!store?.avatarPath) {console.log(JSON.stringify({result:'NO_PUBLIC_AVATAR'}));process.exit(0);}
 const origin='http://127.0.0.1:4000';
 const imageUrl=origin+sellerAvatarUrl(store.id,store.avatarPath);
 const storeUrl=origin+'/api/v1/seller-profiles/'+store.id;
 const response=await fetch(imageUrl,{signal:AbortSignal.timeout(15000),cache:'no-store'});
 const bytes=response.ok?Buffer.from(await response.arrayBuffer()):Buffer.alloc(0);
 const profile=await fetch(storeUrl,{signal:AbortSignal.timeout(5000),cache:'no-store'});
 const data=profile.ok?await profile.json():null;
 console.log(JSON.stringify({
  operation:'READ_ONLY',origin:'localhost API',imageStatus:response.status,
  imageContentType:response.headers.get('content-type'),
  imageCacheControl:response.headers.get('cache-control'),
  imageBytes:bytes.byteLength,
  imageSha256:bytes.byteLength?createHash('sha256').update(bytes).digest('hex'):null,
  publicProfileStatus:profile.status,
  publicAvatarVersionMatchesExpected:data?.avatarUrl===sellerAvatarUrl(store.id,store.avatarPath)
 }));
} catch(err) {console.error('AVATAR_HTTP_PROBE_ERROR='+((err as Error).name||'unknown'));process.exitCode=1;}
finally {await db.$disconnect();}
