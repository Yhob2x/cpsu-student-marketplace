import { prisma } from './src/db.js';
import { Prisma } from '@prisma/client';
const current = await prisma.$queryRaw<Array<{table_name:string,column_name:string}>>(Prisma.sql`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND ((table_name='SellerProfile' AND column_name IN ('avatarPath','pendingAvatarPath','approvalStatus')) OR (table_name='Listing' AND column_name IN ('reservationTransactionId','availabilityState','deletedAt','condition')) OR (table_name='ListingReview' AND column_name IN ('decision','createdAt'))) ORDER BY table_name,column_name`);
console.log('COLUMNS',JSON.stringify(current));
const migrations=await prisma.$queryRaw<Array<{migration_name:string,finished_at:Date|null}>>(Prisma.sql`SELECT migration_name,finished_at FROM _prisma_migrations ORDER BY started_at`);
console.log('MIGRATIONS',JSON.stringify(migrations.map(x=>({name:x.migration_name,applied:!!x.finished_at}))));
const sample=await prisma.$queryRaw<Array<{id:number}>>(Prisma.sql`SELECT id FROM Listing WHERE status='published' LIMIT 1`);
console.log('PUBLISHED_LISTING_EXISTS',sample.length>0);
try { const result=await prisma.listing.findMany({where:{status:'published',deletedAt:null},select:{id:true,seller:{select:{id:true,avatarPath:true}}},take:1}); console.log('PRISMA_SELLER_SELECT','PASS',result.length); } catch(e:any){console.log('PRISMA_SELLER_SELECT','FAIL',e.code||e.name,JSON.stringify(e.meta||{}));}
try { const result=await prisma.listing.findMany({where:{status:'published',deletedAt:null},select:{id:true,seller:{select:{id:true,storeName:true}}},take:1}); console.log('PRISMA_LEGACY_SELECT','PASS',result.length); } catch(e:any){console.log('PRISMA_LEGACY_SELECT','FAIL',e.code||e.name,JSON.stringify(e.meta||{}));}
await prisma.$disconnect();