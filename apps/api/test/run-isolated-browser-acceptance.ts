/**
 * Real React + API browser journey against synthetic local MySQL only.
 * Usage from apps/api: CPSU_BROWSER_ACCEPTANCE=1 bun test/run-isolated-browser-acceptance.ts
 * Requires the dedicated test schema already prepared by test:integration.
 * No remote staging, no real student accounts, no delivery/enrollment.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { snapshotTestMedia, cleanupNewTestMedia } from './isolated-media-cleanup.js';

if (process.env.CPSU_BROWSER_ACCEPTANCE !== '1') {
  throw new Error('Explicit CPSU_BROWSER_ACCEPTANCE=1 opt-in is required.');
}
const source = process.env.DATABASE_URL;
if (!source) throw new Error('Local DATABASE_URL is required.');
const current = new URL(source);
if (!['localhost', '127.0.0.1', '::1'].includes(current.hostname) ||
    decodeURIComponent(current.pathname.slice(1)) !== 'cpsu_marketplace' ||
    process.env.NODE_ENV === 'production') {
  throw new Error('REFUSING browser setup outside the local CPSU development source.');
}
const db = new URL(source);
db.pathname = '/cpsu_marketplace_test';
const repo = path.resolve(import.meta.dir, '../../..');
const web = path.join(repo, 'apps/web');
const uploads = path.join(os.tmpdir(), 'cpsu-marketplace-stage1-test-uploads');
const apiEnv = {
  ...process.env,
  NODE_ENV: 'test',
  CPSU_INTEGRATION_TESTS: '1',
  DATABASE_URL: db.toString(),
  BIND_HOST: '127.0.0.1',
  PORT: '4011',
  CORS_ORIGINS: 'http://127.0.0.1:5187',
  UPLOAD_DIR: uploads,
  MEDIA_STORAGE: 'local',
  GOOGLE_DRIVE_CLIENT_ID: '',
  GOOGLE_DRIVE_CLIENT_SECRET: '',
  GOOGLE_DRIVE_REFRESH_TOKEN: '',
  GOOGLE_DRIVE_FOLDER_ID: '',
  STUDENT_ID_COLLECTION_ENABLED: 'false',
  PUSH_SUBSCRIPTIONS_ENABLED: 'false',
  PUSH_DELIVERY_ENABLED: 'false',
};
Object.assign(process.env, apiEnv);
const { assertIsolatedTestDatabase, resetFixtures, seedFixtures } = await import('./integration/fixtures.js');
assertIsolatedTestDatabase();
const { prisma } = await import('../src/db.js');
const { hashPassword } = await import('../src/auth.js');
const webEnv: Record<string,string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && !/DATABASE|PASSWORD|SECRET|TOKEN|KEY|VAPID|GOOGLE_DRIVE|JWT|CREDENTIAL/i.test(k)) {
    webEnv[k] = v;
  }
}
webEnv.NODE_ENV = 'test';
webEnv.CPSU_INTEGRATION_TESTS = '1';
let apiProcess: ReturnType<typeof Bun.spawn> | undefined;
let webProcess: ReturnType<typeof Bun.spawn> | undefined;

async function isListening(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(600) });
    return true; // HTTP 404 still means this port belongs to a running process.
  } catch { return false; }
}

async function ready(url: string, label: string) {
  for (let n=0; n<60; n++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {}
    await Bun.sleep(200);
  }
  throw new Error(label + ' did not become ready on loopback');
}
async function cli(command: string, logFile: string, expectSuccess = true) {
  const child = Bun.spawn(['cmd.exe','/d','/c',command], {
    cwd: web, env: webEnv, stdout: 'pipe', stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  await fs.writeFile(path.join(repo, '.tmp', logFile), stdout + '\n' + stderr);
  if (code !== 0 && expectSuccess) {
    throw new Error('Browser command failed (exit '+code+') '+logFile+'\n'+(stdout+'\n'+stderr).slice(-1900));
  }
  return stdout;
}

let success = false;
let ownsFixtureLifecycle = false;
let priorTestMedia: Set<string> | null = null;
try {
  if (await isListening(4011) || await isListening(5187)) {
    throw new Error('Isolated acceptance ports already occupied; refusing to reuse a stale or unknown server.');
  }
  ownsFixtureLifecycle = true;
  priorTestMedia = await snapshotTestMedia(uploads);
  await resetFixtures(prisma);
  await seedFixtures(prisma, hashPassword);
  // Only these two loopback ports connect to the isolated database.
  apiProcess = Bun.spawn(['bun', path.join(import.meta.dir, '../src/index.ts')], {
    cwd: path.join(repo,'apps/api'), env: apiEnv, stdout: 'inherit', stderr: 'inherit',
  });
  webProcess = Bun.spawn(['bun',path.join(web,'node_modules/vite/bin/vite.js'),
    '--config','vite.acceptance.config.ts','--host','127.0.0.1','--port','5187'], {
    cwd: web, env: webEnv, stdout: 'inherit', stderr: 'inherit',
  });
  await ready('http://127.0.0.1:4011/health','isolated API');
  await ready('http://127.0.0.1:5187/','isolated Vite');
  console.log('ISOLATED BROWSER HOSTS READY (synthetic data and push disabled)');
  await cli('playwright-cli -s=cpsu-real-acceptance open http://127.0.0.1:5187/ --browser=chrome',
    'p1-real-browser-open.log');
  const output = await cli('playwright-cli -s=cpsu-real-acceptance run-code --filename=' +
    path.join(web,'test/real-auth-browser-acceptance.smoke.js'),
    'p1-real-browser-journey.log');
  console.log(output.slice(0,700));
  success = true;
} finally {
  if (ownsFixtureLifecycle) {
  await cli('playwright-cli -s=cpsu-real-acceptance close','p1-real-browser-close.log',false).catch(()=>{});
  // On Windows Bun can launch a command shim that has its own Bun child.
  // Kill the *still-alive* process tree first; killing only its parent
  // earlier left a localhost server orphaned after acceptance.
  for (const worker of [apiProcess,webProcess]) {
    if (worker?.pid && process.platform === 'win32') {
      const result = Bun.spawnSync(['taskkill.exe','/PID',String(worker.pid),'/T','/F'],
        { stdout:'pipe', stderr:'pipe' });
      console.log('Acceptance process-tree stop:', worker.pid, 'exit', result.exitCode);
    }
  }
  apiProcess?.kill();
  webProcess?.kill();
  await Promise.all([apiProcess?.exited,webProcess?.exited]);
  await Bun.sleep(250);
  const staleHost = await isListening(4011) || await isListening(5187);
  await resetFixtures(prisma);
  // Database deletion does not remove uploaded test image bytes.
  const removedMedia = priorTestMedia ? await cleanupNewTestMedia(uploads, priorTestMedia) : 0;
  // Trust the isolated cleanup only after checking the most sensitive synthetic tables.
  const remaining = await Promise.all([
    prisma.user.count(), prisma.session.count(), prisma.sellerProfile.count(),
    prisma.storeFollow.count(), prisma.listing.count(), prisma.homePageContent.count(),
    prisma.transaction.count(), prisma.notification.count(),
  ]);
  await prisma.$disconnect();
  if (remaining.some(count => count !== 0)) {
    throw new Error('Isolated browser data cleanup incomplete: synthetic rows remain.');
  }
  if (staleHost) throw new Error('A local acceptance host is still listening after cleanup.');
  console.log('ISOLATED SYNTHETIC DATA CLEARED (8 table counts zero); '+removedMedia+' new media removed; both loopback ports closed.');
  } else {
    // A preflight port conflict must never reset someone else's in-use test fixtures.
    await prisma.$disconnect();
  }
}
if (success) console.log('P1 real browser authentication journey PASSED (not physical-device acceptance).');
