/**
 * Disposable synthetic login for localhost HTTPS PWA QA.
 * RUN ONLY with CPSU_PWA_HTTPS_QA=1, NODE_ENV=test, test database.
 * Run: bun test/https-push-qa-fixture.ts prepare | cleanup
 * Credentials are random and stored in the current user's TEMP dir, never logged.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const email = 'https-push-qa@example.invalid';
const path = join(process.env.TEMP ?? '', 'cpsu-push-https-synthetic-login.json');
const url = new URL(process.env.DATABASE_URL ?? '');
if (process.env.CPSU_PWA_HTTPS_QA !== '1' || process.env.NODE_ENV !== 'test' ||
    !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== 'cpsu_marketplace_push_test') {
  throw new Error('Refusing fixture write outside isolated local push test schema.');
}
const mode = process.argv[2];
if (!['prepare','cleanup'].includes(mode)) throw new Error('Expected prepare or cleanup.');
const prisma = new PrismaClient();
try {
  if (mode === 'prepare') {
    if (existsSync(path)) throw new Error('Private QA credentials already exist: clean up first.');
    if (await prisma.user.findUnique({ where: { email } })) throw new Error('Old synthetic QA user remains: clean up first.');
    const password = randomBytes(24).toString('base64url');
    await prisma.user.create({
      data: { email, displayName: 'Synthetic HTTPS QA', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) },
    });
    writeFileSync(path, JSON.stringify({ email, password }), { flag: 'wx', mode: 0o600 });
    console.log('Synthetic HTTPS QA user created in isolated test schema; temporary credentials kept private.');
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.pushSubscription.deleteMany({ where: { userId: user.id } });
      await prisma.pushPreference.deleteMany({ where: { userId: user.id } });
      await prisma.notification.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.affiliation.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    if (existsSync(path)) unlinkSync(path);
    console.log('Synthetic HTTPS QA account and private temporary credential file deleted.');
  }
} finally { await prisma.$disconnect(); }
