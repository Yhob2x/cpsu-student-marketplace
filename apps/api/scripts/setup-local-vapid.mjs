/**
 * Local-only, idempotent VAPID setup for the CPSU development API.
 * Run: cd apps/api && bun scripts/setup-local-vapid.mjs --development
 *
 * Writes keys only to the existing ignored apps/api/.env. Never prints key material.
 * The localhost VAPID contact URL is for development only and must be replaced
 * with a real monitored contact URL/email before deployment.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateVAPIDKeys } from 'web-push';

if (process.argv.length !== 3 || process.argv[2] !== '--development' ||
    process.env.NODE_ENV === 'production') throw new Error('Explicit local development approval required.');

const here = resolve(import.meta.dirname, '..');
const repo = resolve(here, '..', '..');
const envFile = resolve(here, '.env');
if (!existsSync(envFile)) throw new Error('Existing local API .env file not found.');
const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost','127.0.0.1','::1'].includes(database.hostname) ||
    decodeURIComponent(database.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('VAPID setup is restricted to the local CPSU development database.');
}
const ignored = spawnSync('git', ['check-ignore', '-q', envFile], {
  cwd: repo, windowsHide: true, stdio: 'ignore',
});
if (ignored.status !== 0) throw new Error('API .env is not excluded from Git; refusing to write secrets.');
const original = readFileSync(envFile, 'utf8');
const keys = ['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
const read = (key) => {
  const match = original.match(new RegExp('^\\s*' + key + '\\s*=\\s*(.*)$', 'm'));
  return match ? match[1].trim().replace(/^(["'])(.*)\\1$/, '$2') : '';
};
const values = Object.fromEntries(keys.map(key => [key, read(key)]));
if (keys.every(key => values[key])) {
  console.log('VAPID settings already present; left unchanged. Key material not displayed.');
  process.exit(0);
}
if (keys.some(key => values[key])) {
  throw new Error('Partial VAPID configuration detected; manual review required. No keys overwritten.');
}
const pair = generateVAPIDKeys();
if (!/^[A-Za-z0-9_-]{87}$/.test(pair.publicKey) ||
    !/^[A-Za-z0-9_-]{43}$/.test(pair.privateKey)) {
  throw new Error('Unexpected VAPID key format; no configuration written.');
}
const newline = original.includes('\r\n') ? '\r\n' : '\n';
const tail = original.endsWith('\n') ? '' : newline;
const next = original + tail + [
  '# Local PWA Web Push QA only. Before HTTPS deployment replace subject with a monitored contact.',
  'VAPID_PUBLIC_KEY="' + pair.publicKey + '"',
  'VAPID_PRIVATE_KEY="' + pair.privateKey + '"',
  'VAPID_SUBJECT="https://localhost:8443/"',
  '',
].join(newline);
writeFileSync(envFile, next, { mode: 0o600 });
const verify = readFileSync(envFile, 'utf8');
if (!verify.includes('VAPID_PRIVATE_KEY="' + pair.privateKey + '"')) {
  throw new Error('Local VAPID file verification failed; inspect the local .env privately.');
}
console.log('VAPID pair stored in ignored local API .env; no credentials printed.');
console.log('Local-only subject https://localhost:8443/ (replace before deployment).');
console.log('Restart a development API instance to load the new settings. Public HTTPS is not enabled.');
