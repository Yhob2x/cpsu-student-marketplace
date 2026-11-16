// READ-ONLY: inspect only the isolated HTTPS iPhone test DB. Never connect to main DB for queries.
import { PrismaClient } from '@prisma/client';
const src = new URL(process.env.DATABASE_URL || '');
if (process.env.CPSU_IPHONE_LOGIN_PREFLIGHT !== '1' ||
    process.env.NODE_ENV === 'production' ||
    !['127.0.0.1', 'localhost', '::1'].includes(src.hostname) ||
    decodeURIComponent(src.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('Refusing to inspect without explicit local development database guard.');
}
src.pathname = '/cpsu_marketplace_push_test';
const db = new PrismaClient({ datasources: { db: { url: src.toString() } } });
try {
  const [users, campuses, examples] = await Promise.all([
    db.user.count(),
    db.campus.count(),
    db.user.findMany({ where: { email: { in: ['buyer@dev.test', 'seller@dev.test', 'iphone-buyer@dev.test'] } },
      select: { email: true, status: true } }),
  ]);
  console.log(JSON.stringify({ testDatabase: 'cpsu_marketplace_push_test', users, campuses,
    examples: examples.map(x => ({ email: x.email, status: x.status })) }, null, 2));
} finally { await db.$disconnect(); }
