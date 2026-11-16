/**
 * Isolated Web Push integration test database. Never writes to the development schema.
 * Run from apps/api: bun run test:push:integration
 */
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { generateVAPIDKeys } from 'web-push';

const SOURCE_DB = 'cpsu_marketplace';
const TEST_DB = 'cpsu_marketplace_push_test';
const source = process.env.DATABASE_URL;
if (!source) throw new Error('DATABASE_URL must refer to local CPSU development MySQL.');
const url = new URL(source);
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  || decodeURIComponent(url.pathname.slice(1)) !== SOURCE_DB
  || process.env.NODE_ENV === 'production') {
  throw new Error('Push integration tests require the local development connection; no remote/production database is permitted.');
}
const isolated = new URL(source);
isolated.pathname = '/' + TEST_DB;
const keys = generateVAPIDKeys();
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: isolated.toString(),
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'mailto:qa-push@example.invalid',
  // Test-mode accepts synthetic enrollment; outbound Web Push stays suppressed regardless.
  PUSH_SUBSCRIPTIONS_ENABLED: 'true',
  PUSH_DELIVERY_ENABLED: 'false',
  CPSU_PUSH_TESTS: '1',
};

const admin = new PrismaClient({ datasources: { db: { url: source } } });
try {
  await admin.$executeRawUnsafe(
    'CREATE DATABASE IF NOT EXISTS `' + TEST_DB + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
} finally { await admin.$disconnect(); }

async function run(name: string, command: string[]) {
  console.log('Push QA: ' + name);
  const child = Bun.spawn(command, {
    cwd: path.resolve(import.meta.dir, '..'),
    env, stdout: 'inherit', stderr: 'inherit',
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(name + ' failed (exit ' + code + ').');
}
await run('apply migrations to isolated push test schema only', ['bunx', 'prisma', 'migrate', 'deploy']);
await run('test authenticated push routes with synthetic users/endpoints', ['bun', 'test', 'test/integration/push.test.ts']);
// Separate test process is required: environment flags are parsed once at API import.
env.CPSU_PUSH_TESTS = '0';
env.CPSU_PUSH_DISABLED_TESTS = '1';
env.PUSH_SUBSCRIPTIONS_ENABLED = 'false';
env.PUSH_DELIVERY_ENABLED = 'false';
await run('verify server refuses subscriptions when release switches are disabled', ['bun', 'test', 'test/integration/push-disabled.test.ts']);
console.log('Push integration passed. Development and production databases were not migrated. No remote pushes were delivered.');
