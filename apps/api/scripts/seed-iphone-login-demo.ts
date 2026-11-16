/**
 * Add ONLY two synthetic unprivileged accounts to CPSU's isolated iPhone QA database.
 * Never seeds development, production, or real students. No schema migrations.
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const source = new URL(process.env.DATABASE_URL || '');
if (process.env.CPSU_IPHONE_DEMO_SEED !== '1' ||
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '::1'].includes(source.hostname) ||
    decodeURIComponent(source.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('Refusing to seed without the explicit local development test guard.');
}
source.pathname = '/cpsu_marketplace_push_test';
const db = new PrismaClient({ datasources: { db: { url: source.toString() } } });
const password = 'DevPassword!123'; // Existing, explicitly test-only password from prisma/seed.ts
try {
  const [users, campuses, existing] = await Promise.all([
    db.user.count(),
    db.campus.count(),
    db.user.findMany({ select: { email: true }, take: 3 }),
  ]);
  if (users !== 0 || campuses !== 0 || existing.length !== 0) {
    throw new Error('Test schema is no longer empty: refusing to change existing accounts or campus records.');
  }
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await db.$transaction(async tx => {
    const campus = await tx.campus.create({ data: { code: 'CAUAYAN', name: 'Cauayan Campus', active: true } });
    for (const student of [
      { email: 'buyer@dev.test', displayName: 'Demo Buyer' },
      { email: 'seller@dev.test', displayName: 'Demo Seller' },
    ]) {
      await tx.user.create({ data: {
        ...student, passwordHash: hash, status: 'active',
        affiliations: { create: {
          campusId: campus.id, verificationStatus: 'verified',
          verifiedAt: new Date(),
        } },
      } });
    }
  });
  console.log('PASS: isolated test database seeded with two synthetic unprivileged active accounts.');
  console.log('Login email: buyer@dev.test or seller@dev.test (existing dev-seed demo password).');
  console.log('No real accounts, roles, production data or migrations touched.');
} finally { await db.$disconnect(); }
