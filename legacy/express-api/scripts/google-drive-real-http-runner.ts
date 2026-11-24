/**
 * Opt-in HTTP acceptance against REAL Google Drive, with a fresh throwaway
 * local MySQL schema. Never touches cpsu_marketplace rows or student media.
 * Requires an operator-provided OAuth token and private Drive folder.
 */
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const source = process.env.DATABASE_URL;
if (!source) throw new Error('DATABASE_URL missing.');
const sourceUrl = new URL(source);
if (process.env.NODE_ENV === 'production' ||
    !['127.0.0.1', 'localhost', '::1'].includes(sourceUrl.hostname) ||
    decodeURIComponent(sourceUrl.pathname) !== '/cpsu_marketplace') {
  throw new Error('Blocked: this test is permitted only from the CPSU local development database.');
}
if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    !process.env.GOOGLE_DRIVE_REFRESH_TOKEN || !process.env.GOOGLE_DRIVE_FOLDER_ID) {
  throw new Error('Private Google Drive configuration is incomplete.');
}
const scratchName = 'cpsu_drive_smoke_' + randomBytes(5).toString('hex');
const scratchUrl = new URL(source);
scratchUrl.pathname = '/' + scratchName;
const uploadDir = await mkdtemp(path.join(tmpdir(), 'cpsu-drive-http-smoke-'));
const admin = new PrismaClient({ datasources: { db: { url: source } } });
let created = false;
const childEnv = {
  ...process.env,
  DATABASE_URL: scratchUrl.toString(),
  NODE_ENV: 'test',
  MEDIA_STORAGE: 'google_drive',
  UPLOAD_DIR: uploadDir,
  CPSU_DRIVE_REAL_HTTP_TEST: scratchName,
};
async function run(command: string[]) {
  const child = Bun.spawn(command, {
    cwd: path.resolve(import.meta.dir, '..'),
    env: childEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await child.exited;
  if (code !== 0) throw new Error('Isolated Drive HTTP acceptance failed.');
}
try {
  await admin.$executeRawUnsafe(
    'CREATE DATABASE `' + scratchName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  created = true;
  console.log('Temporary isolated test database created (no development rows modified).');
  await run(['bunx', 'prisma', 'migrate', 'deploy']);
  await run(['bun', 'test', 'test/google-drive-real-http.test.ts']);
  console.log('REAL_GOOGLE_DRIVE_HTTP_ACCEPTANCE: PASS');
} finally {
  if (created) {
    await admin.$executeRawUnsafe('DROP DATABASE `' + scratchName + '`');
    console.log('Temporary test database removed.');
  }
  await admin.$disconnect();
  await rm(uploadDir, { recursive: true, force: true });
  console.log('Temporary local upload staging cleaned.');
}
