/**
 * Sequential synthetic-only MySQL integration runner.
 * A read-only preflight must confirm the EXISTING test schema is empty and
 * migration-current. The runner never creates a schema or applies DDL.
 * Run from apps/api: bun run test:integration
 */
import path from 'node:path';
import os from 'node:os';
import { checkIntegrationSource, INTEGRATION_TEST_DB } from '../src/integration-target-policy.js';

const args = process.argv.slice(2);
if (args.some(value => value !== '--preflight-only')) throw new Error('Unrecognized integration runner option.');
const preflightOnly = args.includes('--preflight-only');
const source = process.env.DATABASE_URL;
const errors = checkIntegrationSource(source, process.env.NODE_ENV);
if (errors.length) throw new Error('Unsafe integration source: ' + errors.join(' '));
const testUrl = new URL(source!);
testUrl.pathname = '/' + INTEGRATION_TEST_DB;

const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: testUrl.toString(),
  UPLOAD_DIR: path.join(os.tmpdir(), 'cpsu-marketplace-stage1-test-uploads'),
  MEDIA_STORAGE: 'local',
  STUDENT_ID_COLLECTION_ENABLED: 'false',
  STUDENT_ID_PRIVACY_APPROVAL_REF: '',
  // Never upload or deliver anything outside this test process.
  GOOGLE_DRIVE_CLIENT_ID: '',
  GOOGLE_DRIVE_CLIENT_SECRET: '',
  GOOGLE_DRIVE_REFRESH_TOKEN: '',
  GOOGLE_DRIVE_FOLDER_ID: '',
  PUSH_SUBSCRIPTIONS_ENABLED: 'false',
  PUSH_DELIVERY_ENABLED: 'false',
  CPSU_INTEGRATION_TESTS: '1',
};
const cwd = path.resolve(import.meta.dir, '..');
async function run(label: string, args: string[], processEnv: NodeJS.ProcessEnv) {
  console.log('\nIsolated QA: ' + label);
  const child = Bun.spawn(args, { cwd, env: processEnv, stdout: 'inherit', stderr: 'inherit' });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(label + ' blocked or failed (exit ' + exitCode + ').');
}

// Preflight uses ONLY local info_schema and reads the named test schema.
// A pending migration, unexpected account, or even one leftover row blocks testing.
await run('read-only empty-schema and migration-inventory preflight',
  ['bun', 'scripts/integration-target-preflight.ts', '--audit-only'], process.env);
if (preflightOnly) {
  console.log('PREFLIGHT ONLY: No test fixtures were created or reset.');
  process.exit(0);
}
await run('run Stage 1 HTTP/DB integration tests', ['bun', 'test', 'test/integration/stage1.test.ts'], env);
await run('run real-login cross-role acceptance', ['bun', 'test', 'test/integration/authenticated-journey.test.ts'], env);
// Each suite resets ONLY synthetic fixtures in the approved test database.
// Running suites in parallel could let one suite delete another suite's fixtures.
await run('run public-report security acceptance', ['bun', 'test', 'test/integration/report.test.ts'], env);
await run('run conversation-closure safety acceptance', ['bun', 'test', 'test/integration/inquiry-close.test.ts'], env);
await run('run bounded synthetic close/send stress', ['bun', 'test', 'test/integration/inquiry-close-stress.test.ts'], env);
await run('audit isolated schema foreign keys and indexes',
  ['bun', 'scripts/integrity-audit.ts'], env);
await run('verify test cleanup and migration inventory stayed intact',
  ['bun', 'scripts/integration-target-preflight.ts', '--audit-only'], process.env);
console.log('\nPASS: Synthetic integration completed. No database creation or migrations were performed.');
