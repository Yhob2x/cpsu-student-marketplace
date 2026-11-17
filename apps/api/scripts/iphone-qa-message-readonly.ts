/** Read-only, isolated iPhone QA messaging verification. No message bodies or passwords. */
import { PrismaClient } from '@prisma/client';
const u = new URL(process.env.DATABASE_URL ?? '');
if (u.protocol !== 'mysql:' || u.hostname !== '127.0.0.1' ||
    u.port !== '3306' || u.pathname !== '/cpsu_marketplace' ||
    u.search || u.hash) throw new Error('REFUSED: unexpected source DB');
u.pathname = '/cpsu_marketplace_push_test';
const db = new PrismaClient({ datasources: { db: { url: u.href } } });
try {
  const identity = await db.$queryRawUnsafe<Array<{ db: string }>>('SELECT DATABASE() AS db');
  if (identity[0]?.db !== 'cpsu_marketplace_push_test')
    throw new Error('REFUSED: DB is not isolated QA');
  const buyer = await db.user.findUnique({
    where: { email: 'cpsu-iphone-buyer-20261117@example.invalid' },
    select: { id: true, sessions: { select: { createdAt: true, expiresAt: true, revokedAt: true },
      orderBy: { createdAt: 'desc' }, take: 12 } },
  });
  if (!buyer) throw new Error('REFUSED: synthetic QA buyer is absent');
  const seller = await db.user.findUnique({
    where: { email: 'cpsu-iphone-seller-20261117@example.invalid' },
    select: { id: true, sessions: { select: { createdAt: true, expiresAt: true, revokedAt: true },
      orderBy: { createdAt: 'desc' }, take: 12 } },
  });
  if (!seller) throw new Error('REFUSED: synthetic QA seller is absent');
  const threads = await db.inquiryThread.findMany({
    where: { buyerUserId: buyer.id, listingId: 9 },
    select: { id: true, createdAt: true }, take: 12,
  });
  const messages = await db.inquiryMessage.count({
    where: { threadId: { in: threads.map(t => t.id) } },
  });
  console.log('QA_MESSAGE_READONLY ' + JSON.stringify({
    database: 'cpsu_marketplace_push_test', buyerExists: true,
    buyerSessions: buyer.sessions.length,
    buyerActiveSessions: buyer.sessions.filter(s => !s.revokedAt && s.expiresAt > new Date()).length,
    buyerSyntheticListingThreads: threads.length,
    sellerSessions: seller.sessions.length,
    sellerActiveSessions: seller.sessions.filter(s => !s.revokedAt && s.expiresAt > new Date()).length,
    storedMessageCount: messages,
  }));
} finally { await db.$disconnect(); }
