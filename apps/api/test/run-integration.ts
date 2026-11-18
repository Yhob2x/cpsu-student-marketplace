/**
 * Stage 1 integration runner. The development database is used ONLY as a connection
 * from which to provision a different, dedicated test database; no test data
 * is written into the development schema.
 *
 * Run from apps/api: bun run test:integration
 */
import path from 'node:path';
import os from 'node:os';
import { PrismaClient } from '@prisma/client';

const SOURCE_DB = 'cpsu_marketplace';
const TEST_DB = 'cpsu_marketplace_test';
const source = process.env.DATABASE_URL;
if (!source) throw new Error('DATABASE_URL is required to locate the local MySQL server.');
const url = new URL(source);
const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || dbName !== SOURCE_DB) {
  throw new Error('Stage 1 runner requires a local CPSU development connection; no remote or unexpected database is allowed.');
}
if (process.env.NODE_ENV === 'production') throw new Error('Integration tests cannot run in production.');
const testUrl = new URL(source);
testUrl.pathname = '/' + TEST_DB;

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testUrl.toString(),
  UPLOAD_DIR: path.join(os.tmpdir(), 'cpsu-marketplace-stage1-test-uploads'),
  // Never let an operator's development Google Drive configuration receive synthetic test files.
  MEDIA_STORAGE: 'local',
  GOOGLE_DRIVE_CLIENT_ID: '',
  GOOGLE_DRIVE_CLIENT_SECRET: '',
  GOOGLE_DRIVE_REFRESH_TOKEN: '',
  GOOGLE_DRIVE_FOLDER_ID: '',
  CPSU_INTEGRATION_TESTS: '1',
};

// The test suite verifies the destination again before it queries or resets any rows.
// Provision only the named test schema, never change or drop the dev schema.
const admin = new PrismaClient({ datasources: { db: { url: source } } });
try {
  await admin.$executeRawUnsafe(
    'CREATE DATABASE IF NOT EXISTS \`' + TEST_DB + '\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
  );
} catch (e) {
  throw new Error('Cannot provision the isolated test database. Grant CREATE on the local MySQL server, or provision ' + TEST_DB + ' manually. ' + String(e));
} finally {
  await admin.$disconnect();
}

async function run(label: string, args: string[]) {
  console.log('\nStage 1: ' + label);
  const child = Bun.spawn(args, { cwd: path.resolve(import.meta.dir, '..'), env, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(label + ' failed (exit ' + exitCode + ').');
}

await run('deploy existing migrations to isolated test database', ['bunx', 'prisma', 'migrate', 'deploy']);
await run('run Stage 1 integration tests', ['bun', 'test', 'test/integration/stage1.test.ts']);
await run('run P1 real-login cross-role acceptance against isolated test data', ['bun', 'test', 'test/integration/authenticated-journey.test.ts']);
// Sequential suites: each resets its own synthetic fixtures in the SAME guarded test database.
// Never run these files together in one Bun test process; parallel fixture cleanup would conflict.
await run('run real MySQL public-report security acceptance', ['bun', 'test', 'test/integration/report.test.ts']);
await run('run real MySQL conversation-closure safety acceptance', ['bun', 'test', 'test/integration/inquiry-close.test.ts']);
// Bounded contention is isolated in its own process and fixture lifecycle.
await run('run bounded synthetic close/send MySQL stress', ['bun', 'test', 'test/integration/inquiry-close-stress.test.ts']);
await run('audit foreign keys, orphan rows and discovery indexes without mutation', ['bun', 'scripts/integrity-audit.ts']);
console.log('\nStage 1 integration suite completed; application database was not used for test fixtures.');
