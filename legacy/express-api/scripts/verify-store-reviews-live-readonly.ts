import { PrismaClient } from '@prisma/client';
import { visibleStudentStoreWhere } from '../src/store-visibility.js';
const db = new PrismaClient();
try {
  const counts = {
    reviews: await db.storeReview.count(),
    pending: await db.storeReview.count({ where: { status: 'pending' } }),
    published: await db.storeReview.count({ where: { status: 'published' } }),
    completedTransactions: await db.transaction.count({ where: { status: 'completed' } }),
  };
  const publicStore = await db.sellerProfile.findFirst({ where: visibleStudentStoreWhere(), select: { id: true } });
  console.log('SCHEMA_STORE_REVIEW_PRESENT', Boolean(db.storeReview));
  console.log('COUNTS', JSON.stringify(counts));
  if (publicStore) {
    const res = await fetch('http://127.0.0.1:4000/api/v1/seller-profiles/' + publicStore.id + '/reviews');
    const json = await res.json();
    console.log('PUBLIC_GET_STATUS', res.status);
    console.log('PUBLIC_AVAILABLE', json.available);
    console.log('PUBLIC_SUMMARY_SHAPE', json?.summary ? 'present' : 'missing');
    if (res.status !== 200 || json.available !== true || typeof json?.summary?.count !== 'number')
      throw new Error('Review API is not available for a public store');
  } else console.log('PUBLIC_STORE_NONE_ELIGIBLE');
  const guest = await fetch('http://127.0.0.1:4000/api/v1/admin/store-reviews');
  console.log('GUEST_ADMIN_STATUS',guest.status);
  if (guest.status !== 401 && guest.status !== 403) throw new Error('Moderation queue accessible to guest');
} finally { await db.$disconnect(); }
