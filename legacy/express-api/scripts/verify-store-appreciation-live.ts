/** Read-only local activation verification. Does not create or delete appreciation data. */
import { PrismaClient } from '@prisma/client';
import { visibleStudentStoreWhere } from '../src/store-visibility.js';
const db = new PrismaClient();
try {
  const store = await db.sellerProfile.findFirst({
    where: visibleStudentStoreWhere(), select: { id: true },
  });
  if (!store) throw Error('No eligible public student store available to verify GET route');
  const res = await fetch('http://127.0.0.1:4000/api/v1/seller-profiles/' + store.id + '/appreciations');
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 || body.available !== true ||
    typeof body.count !== 'number' || body.count < 0 ||
    body.isAppreciated !== false) throw Error('Public appreciation route is not ready (HTTP ' + res.status + ')');
  const unauthorized = await fetch('http://127.0.0.1:4000/api/v1/store-appreciations/' + store.id,
    { method: 'PUT' });
  if (unauthorized.status !== 401 && unauthorized.status !== 403)
    throw Error('Guest appreciation write unexpectedly allowed (HTTP ' + unauthorized.status + ')');
  const rows = await db.storeAppreciation.count();
  if (rows !== 0) throw Error('Unexpected appreciation records after activation');
  console.log('LIVE_VERIFY_PASS: public count available=' + body.available +
    ', count=' + body.count + ', guestWriteStatus=' + unauthorized.status +
    ', DBrecords=' + rows);
} finally { await db.$disconnect(); }
