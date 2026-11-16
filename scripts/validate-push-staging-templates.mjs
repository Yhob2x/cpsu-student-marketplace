/**
 * Stage 4 offline template validation. NEVER deploys, connects to hosting, reads .env secrets,
 * or modifies the live API/DB. A PASS means templates are structurally prepared only.
 * Run: node scripts/validate-push-staging-templates.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = join(root, 'infrastructure', 'staging');
const read = file => readFileSync(join(base, file), 'utf8');
const nginx = read('nginx.conf.template');
const service = read('cpsu-marketplace-staging-api.service.template');
const environment = read('staging.env.example');
const apiEnv = readFileSync(join(root, 'apps', 'api', 'src', 'env.ts'), 'utf8');
const apiMain = readFileSync(join(root, 'apps', 'api', 'src', 'index.ts'), 'utf8');

const verdicts = [];
const check = (name, ok) => verdicts.push({ name, ok });
const has = (text, fragment) => text.includes(fragment);

check('Nginx staging host remains an unresolved placeholder',
  (nginx.match(/server_name __STAGING_DOMAIN__;/g) ?? []).length === 2);
check('Staging HTTPS certificate paths remain unresolved',
  has(nginx, 'ssl_certificate __STAGING_CERT_FULLCHAIN__;') &&
  has(nginx, 'ssl_certificate_key __STAGING_CERT_PRIVKEY__;'));
check('HTTP redirects to HTTPS only for the staging host',
  has(nginx, 'return 301 https://$host$request_uri;') &&
  has(nginx, 'listen 443 ssl http2;'));
check('Staging API proxies to 127.0.0.1:4400 only',
  has(nginx, 'location /api/') && has(nginx, 'proxy_pass http://127.0.0.1:4400;') &&
  has(nginx, 'proxy_set_header X-Forwarded-Proto https;'));
check('Dynamic API responses are never cached by Nginx',
  /location \/api\/\s*\{[^}]*?Cache-Control "no-store"/s.test(nginx));
check('Service worker and manifest are refreshed independently',
  has(nginx, 'location = /sw.js') &&
  has(nginx, 'location = /manifest.webmanifest') &&
  (nginx.match(/Cache-Control "no-cache"/g) ?? []).length >= 2);
check('SPA HTML is not cached',
  /location = \/index\.html\s*\{[^}]*?Cache-Control "no-store"/s.test(nginx));
check('Hidden files forbidden and staging excluded from indexing',
  has(nginx, 'location ~ /\\.') && has(nginx, 'return 404;') &&
  has(nginx, 'X-Robots-Tag "noindex, nofollow, noarchive"'));
check('Staging systemd unit explicitly uses Bun, not Node',
  has(service, 'ExecStart=__STAGING_BUN_PATH__ dist/index.js') &&
  !has(service, 'ExecStart=/usr/bin/node'));
check('Separate staging OS identity, environment and writable storage',
  has(service, 'User=marketplace-staging') &&
  has(service, 'EnvironmentFile=/etc/cpsu-marketplace/staging.env') &&
  has(service, 'ReadWritePaths=/var/lib/cpsu-marketplace-staging'));
check('Staging uses production security behavior but isolated database',
  has(environment, 'NODE_ENV=production') &&
  has(environment, 'DATABASE_URL=mysql://__STAGING_DB_USER__:__STAGING_DB_PASSWORD__@127.0.0.1:3306/cpsu_marketplace_staging') &&
  !has(environment, '/cpsu_marketplace_push_test'));
check('Staging API loopback, own port, HTTPS cookies and exact CORS',
  has(environment, 'PORT=4400') &&
  has(environment, 'BIND_HOST=127.0.0.1') &&
  has(environment, 'COOKIE_SECURE=true') &&
  has(environment, 'CORS_ORIGINS=https://__STAGING_DOMAIN__'));
check('Secrets remain placeholders, never actual values',
  has(environment, 'JWT_SECRET=__STAGING_UNIQUE_JWT_SECRET_32_PLUS_CHARS__') &&
  has(environment, 'VAPID_PRIVATE_KEY=__STAGING_VAPID_PRIVATE_KEY__') &&
  has(environment, 'VAPID_SUBJECT=mailto:__APPROVED_MONITORED_CONTACT_EMAIL__'));
check('API runtime accepts explicit loopback binding',
  has(apiEnv, "BIND_HOST: z.enum(['127.0.0.1', '0.0.0.0'])") &&
  has(apiMain, 'listen(env.PORT, env.BIND_HOST,'));
check('No unsafe public CORS wildcard in staging template',
  !has(environment, 'CORS_ORIGINS=*') && !has(nginx, 'Access-Control-Allow-Origin "*"'));

console.log('CPSU PUSH STAGING PACKAGE — LOCAL TEMPLATE VALIDATION');
for (const result of verdicts) console.log((result.ok ? 'PASS' : 'FAIL') + ' ' + result.name);
const failures = verdicts.filter(x => !x.ok);
console.log('Result: ' + verdicts.filter(x => x.ok).length + '/' + verdicts.length +
  ' template checks passed. NO deployment or external push performed.');
console.log('Release still BLOCKED without approved HTTPS staging domain, monitored VAPID contact,');
console.log('independent staging DB, trusted TLS, and physical-device acceptance.');
if (failures.length) process.exitCode = 1;
