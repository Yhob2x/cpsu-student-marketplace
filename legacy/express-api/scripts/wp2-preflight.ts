// Read-only WP2 migration compatibility check. Never logs student records.
import { PrismaClient } from '@prisma/client';
const u = new URL(process.env.DATABASE_URL ?? '');
if (process.env.NODE_ENV === 'production' || !['127.0.0.1','localhost','::1'].includes(u.hostname) ||
    decodeURIComponent(u.pathname.replace(/^\//,'')) !== 'cpsu_marketplace') {
  throw new Error('WP2 audit runs only on the local cpsu_marketplace development database');
}
const prisma = new PrismaClient();
try {
  const value = await prisma.listing.groupBy({ by:['availability', 'type', 'status'], _count:{ _all:true } });
  console.log('Listing state counts:', JSON.stringify(value));
  const total = await prisma.listing.count();
  console.log('Total listings:', total);
  const users = await prisma.user.count();
  console.log('Total users:', users);
} finally { await prisma.$disconnect(); }
