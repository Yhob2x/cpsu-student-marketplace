/**
 * Stage 3 readiness audit for CPSU Market PWA Web Push.
 * Purely local, read-only; no network access, database writes, or secret output.
 * Run: bun run push:staging:check
 * Optional: node scripts/check-push-staging.mjs --url=https://approved-staging.example
 *
 * A PASS means code/config syntax is ready for human staging approval,
 * NOT permission to deploy or evidence of actual push delivery.
 */
import { createECDH } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, 'apps', 'api', '.env');
const web = join(root, 'apps', 'web');
const results = [];
const check = (name, passed, note) => results.push({ name, status: passed ? 'PASS' : 'BLOCKED', note });
const read = (relative) => readFileSync(join(root, relative), 'utf8');
const isRealHost = (host) => {
  const value = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!value || !value.includes('.') ||
      /(?:^|\.)(localhost|local|test|invalid|example)$/.test(value) ||
      /(?:^|\.)example\.(?:com|net|org)$/.test(value) ||
      /(?:^|\.)localhost$/.test(value) ||
      /(?:^|\.)internal$/.test(value) ||
      /(?:^|\.)lan$/.test(value)) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(':')) return false;
  return /^[a-z0-9.-]+$/.test(value);
};
const validPublicUrl = (candidate) => {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (url.port === '' || url.port === '443') && isRealHost(url.hostname);
  } catch { return false; }
};
const validContact = (candidate) => {
  if (candidate.startsWith('mailto:')) {
    const email = candidate.slice(7);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
    return isRealHost(email.split('@').pop());
  }
  return validPublicUrl(candidate);
};

let privateKey = '';
let publicKey = '';
if (existsSync(envFile)) {
  const raw = readFileSync(envFile, 'utf8');
  const field = (key) => {
    const match = raw.match(new RegExp('^\\s*' + key + '\\s*=\\s*(.*)$', 'm'));
    const value = match?.[1]?.trim() ?? '';
    return /^["'].*["']$/.test(value) ? value.slice(1, -1) : value;
  };
  publicKey = field('VAPID_PUBLIC_KEY');
  privateKey = field('VAPID_PRIVATE_KEY');
  const subject = field('VAPID_SUBJECT');
  check('Development push release switches remain disabled',
    field('PUSH_SUBSCRIPTIONS_ENABLED') !== 'true' && field('PUSH_DELIVERY_ENABLED') !== 'true',
    'Local development must not activate subscription enrollment or outbound relay delivery');
  let matching = false;
  if (/^[A-Za-z0-9_-]{87}$/.test(publicKey) && /^[A-Za-z0-9_-]{43}$/.test(privateKey)) {
    try {
      const ecdh = createECDH('prime256v1');
      ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
      matching = ecdh.getPublicKey().toString('base64url') === publicKey;
    } catch { /* Treat malformed keys as blocked. */ }
  }
  check('Persistent matching VAPID key pair', matching, matching ?
    'Stored in local API environment; key material not printed' : 'Review private local API VAPID settings');
  check('Valid non-local VAPID contact syntax', validContact(subject),
    validContact(subject) ? 'A monitored contact must still be approved by CPSU' :
    'Replace development-only localhost subject with an approved, monitored contact before public staging');
  const ignored = spawnSync('git', ['check-ignore', '-q', envFile], {
    cwd: root, windowsHide: true, stdio: 'ignore',
  });
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'apps/api/.env'], {
    cwd: root, windowsHide: true, stdio: 'ignore',
  });
  check('Private API environment excluded from Git', ignored.status === 0 && tracked.status !== 0,
    'Never commit VAPID private keys or DB credentials');
} else {
  check('Persistent matching VAPID key pair', false, 'Local API .env not found');
  check('Valid non-local VAPID contact syntax', false, 'No VAPID contact can be validated');
  check('Private API environment excluded from Git', false, 'Environment file missing');
}

const urlArg = process.argv.find(x => x.startsWith('--url='));
const stageUrl = urlArg ? urlArg.slice('--url='.length) : '';
check('Approved publicly reachable HTTPS staging URL supplied', validPublicUrl(stageUrl),
  validPublicUrl(stageUrl)
    ? 'Syntax only; domain ownership, certificate validity and hosting approval need independent verification'
    : 'No approved HTTPS staging URL given; localhost/HTTP/sample domains are not valid device staging');

const manifestPath = join(web, 'public', 'manifest.webmanifest');
let manifestGood = false;
try {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifestGood = manifest.display === 'standalone' && manifest.start_url === '/' &&
    manifest.scope === '/' && manifest.icons.some(x => (x.purpose ?? '').includes('maskable')) &&
    manifest.icons.some(x => (x.purpose ?? '').includes('any'));
} catch { /* Keep blocked. */ }
check('Installable PWA manifest and maskable icons', manifestGood,
  'Static metadata only; physical Android/iPhone installation must be tested');

let swGood = false;
try {
  const sw = read('apps/web/public/sw.js');
  swGood = sw.includes("addEventListener('push'") &&
    sw.includes("addEventListener('notificationclick'") &&
    sw.includes('showNotification(') &&
    sw.includes("url = pushRoute(") &&
    !sw.includes('caches.match(request)');
} catch { /* Keep blocked. */ }
check('Service worker push/click handlers and offline privacy contract', swGood,
  'Static code check; remote push relay delivery and permission prompts remain untested');

let previewGood = false;
try {
  const client = read('apps/web/src/push-client.ts');
  const panel = read('apps/web/src/push-settings.tsx');
  previewGood = client.includes('previewLocalNotification') &&
    client.includes("Notification.permission !== 'granted'") &&
    panel.includes('Preview a test alert');
} catch { /* Keep blocked. */ }
check('Explicit local notification preview action available', previewGood,
  'This tests only local display; it is not proof of Web Push delivery');

const dist = join(web, 'dist');
let privateKeyLeaked = false;
if (existsSync(dist) && privateKey.length > 0) {
  const queue = [dist];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      const file = join(current, dirent.name);
      if (dirent.isDirectory()) queue.push(file);
      else if (/\.(?:js|html|css|json|webmanifest)$/i.test(dirent.name) &&
               readFileSync(file, 'utf8').includes(privateKey)) privateKeyLeaked = true;
    }
  }
}
check('VAPID private key not found in built web assets', !privateKeyLeaked,
  'Checks local build assets without printing secrets');

console.log('CPSU PWA PUSH — STAGE 3 READINESS (READ-ONLY)');
for (const entry of results) console.log(entry.status.padEnd(7) + ' ' + entry.name + ' — ' + entry.note);
console.log('Remaining independent gates: approved staging deployment, monitored contact, trusted TLS,');
console.log('physical Android/iPhone permission + background push + badge testing, privacy approval.');
console.log('No files, network services, subscriptions, or databases were changed by this audit.');
const blocked = results.filter(x => x.status !== 'PASS').length;
console.log('Readiness: ' + (blocked === 0 ? 'LOCAL CHECKS PASS; DEVICE AND RELEASE ACCEPTANCE STILL PENDING' : blocked + ' staging preparation gate(s) blocked'));
if (blocked > 0) process.exitCode = 2;
