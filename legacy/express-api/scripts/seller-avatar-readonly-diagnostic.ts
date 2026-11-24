/**
 * Read-only, privacy-preserving avatar replacement diagnostic.
 * Prints only aggregates and storage-mode metadata; no names, IDs or paths.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../src/env.js';
import { existsSync } from 'node:fs';
import { localMediaFile } from '../src/media-storage.js';
const url = new URL(process.env.DATABASE_URL || '');
if(url.protocol!=='mysql:' || url.hostname!=='127.0.0.1' ||
  decodeURIComponent(url.pathname.slice(1))!=='cpsu_marketplace')
  throw new Error('REFUSED: only CPSU local dev database');
const db=new PrismaClient();
try {
 const owners=await db.sellerProfile.findMany({
   select:{avatarPath:true, approvalStatus:true, owner:{select:{status:true}}}
 });
 const stored=owners.filter(s=>Boolean(s.avatarPath));
 let local=0,drive=0,localFound=0,localMissing=0;
 for(const s of stored) {
   const path=s.avatarPath!;
   if(path.startsWith('gdrive:')) {drive++; continue;}
   local++;
   try {existsSync(localMediaFile(path))?localFound++:localMissing++;}
   catch {localMissing++;}
 }
 const actions=await db.auditLog.groupBy({
   by:['action'],where:{action:{in:['seller.avatar_published','seller.avatar_removed']}},
   _count:{_all:true}
 });
 console.log(JSON.stringify({
   target:'LOCAL_DEV_ONLY', readOnly:true,
   configuredStorage:env.MEDIA_STORAGE,
   stores:owners.length, storesWithAvatar:stored.length,
   activeApprovedStoresWithAvatar:stored.filter(s=>s.approvalStatus==='approved'&&s.owner.status==='active').length,
   avatarStorageReferences:{local,drive,localFound,localMissing},
   avatarAuditActions:actions.map(x=>({action:x.action,count:x._count._all}))
 }));
}finally{await db.$disconnect();}
