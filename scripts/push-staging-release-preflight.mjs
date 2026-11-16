/**
 * Stage 6: source-only Web Push staging release preflight.
 * READ-ONLY. No DNS queries, HTTP, database connections, shell writes, process launches,
 * server activation, push subscription creation or remote notification delivery.
 *
 * node scripts/push-staging-release-preflight.mjs
 * node scripts/push-staging-release-preflight.mjs --profile=C:\private\staging-approval.json
 *
 * A successful result is only a LOCAL CANDIDATE; institutional approval,
 * domain ownership, network/TLS tests, migration approval and physical phone
 * acceptance remain separate checks.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const exampleProfile = join(root, 'infrastructure', 'staging', 'staging-approval.example.json');
const migrationDir = join(root, 'apps', 'api', 'prisma', 'migrations');

export function realPublicHost(raw) {
  const host = String(raw ?? '').toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || !/^[a-z0-9.-]+$/.test(host) || host.includes('..') ||
      host.startsWith('-') || host.endsWith('-') || host.length > 253) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  if (/(?:^|\.)(localhost|local|internal|lan|invalid|test|example)$/.test(host)) return false;
  if (/(?:^|\.)example\.(com|net|org)$/.test(host)) return false;
  if (host.startsWith('__') || host.includes('_')) return false;
  return true;
}
export function stagingOriginValid(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      u.pathname === '/' && !u.search && !u.hash && realPublicHost(u.hostname);
  } catch { return false; }
}
export function contactValid(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('mailto:')) {
    const email = value.slice(7);
    return /^[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/.test(email) &&
      realPublicHost(email.split('@').at(-1));
  }
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      !u.search && !u.hash && realPublicHost(u.hostname);
  } catch { return false; }
}
const isApproval = v => typeof v === 'string' && v.trim().length >= 3 &&
  !v.includes('__') && !/^(pending|tbd|none|n\/a|todo)$/i.test(v.trim());
const sameMigrations = (actual, selected) =>
  Array.isArray(selected) && selected.every(x => typeof x === 'string') &&
  selected.length === actual.length && new Set(selected).size === actual.length &&
  actual.every(x => selected.includes(x));

export function evaluateReleaseProfile(profile, { migrations, sourceClean, builtSafe, templatesSafe }) {
  const rules = [];
  const check = (label, ok, detail) => rules.push({ label, ok: Boolean(ok), detail });
  check('Approved public HTTPS staging origin specified', stagingOriginValid(profile.stagingOrigin),
    'A syntactically valid URL is not proof of domain ownership');
  check('Public monitored VAPID contact specified', contactValid(profile.vapidContact),
    'Monitoring and institutional permission require human verification');
  check('Named authorized host operator', isApproval(profile.hostingOwner),
    'Who controls this staging environment?');
  check('Deployment approver and written reference',
    isApproval(profile.deploymentApprover) && isApproval(profile.deploymentApprovalReference),
    'Approval reference cannot be inferred from this chat alone');
  check('Privacy/DPO written approval reference', isApproval(profile.privacyApprovalReference),
    'Synthetic student accounts only; confirm retention and consent');
  check('Hosting permission recorded', profile.hostingPermissionConfirmed === true,
    'No public DNS/TLS/hosting operations without permission');
  check('Trusted HTTPS certificate confirmed', profile.trustedHttpsVerified === true,
    'Must be confirmed on the real staging host, not localhost certificate');
  check('Dedicated nonproduction host and database confirmed',
    profile.dedicatedHostAndDatabaseConfirmed === true &&
    profile.stagingDatabase === 'cpsu_marketplace_staging',
    'Do not connect the main development/production DB or copy student data');
  check('Synthetic accounts only', profile.syntheticTestAccountsOnly === true,
    'No real student data or unauthorised notification recipients');
  check('Backup and restore acceptance recorded', profile.backupAndRestorePlanApproved === true,
    'A staging restore plan must be tested before migrations');
  check('Every current migration explicitly approved', sameMigrations(migrations, profile.approvedMigrations),
    'Prisma migrate deploy applies all pending migrations, including unrelated WP3');
  check('Both push release switches remain OFF in Stage 6',
    profile.pushSubscriptionsEnabled === false && profile.pushDeliveryEnabled === false,
    'Real enrollment and remote delivery need separate release gates');
  check('Source tree free of unrelated pending edits', sourceClean,
    'Review/reconcile current WP3, admin, documentation and generated files first');
  check('Local web build has no detected private secrets', builtSafe,
    'Static-only inspection, not a comprehensive external security audit');
  check('Staging templates meet source safety requirements', templatesSafe,
    'Only source-level templates are validated; Nginx/TLS not started');
  const unknownSensitive = Object.keys(profile).filter(x =>
    /(password|private.?key|jwt|secret|token|credential|database.?url)/i.test(x));
  check('Approval manifest contains no credential fields', unknownSensitive.length === 0,
    'Keep passwords, endpoint capability URLs and VAPID private keys outside manifests');
  return rules;
}
export function currentMigrations(dir = migrationDir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter(x => x.isDirectory())
    .map(x => x.name)
    .filter(x => existsSync(join(dir, x, 'migration.sql')))
    .sort();
}
const exec = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8',
    windowsHide: true, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) return null;
  return result.stdout;
};
const webAssets = join(root, 'apps', 'web', 'dist');
function safeWebBundle() {
  if (!existsSync(webAssets)) return false;
  const index = join(webAssets, 'index.html');
  if (!existsSync(index) || !existsSync(join(webAssets, 'sw.js')) ||
      !existsSync(join(webAssets, 'manifest.webmanifest'))) return false;
  const envFile = join(root, 'apps', 'api', '.env');
  const raw = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
  const match = raw.match(/^\s*VAPID_PRIVATE_KEY\s*=\s*(.*)$/m);
  const privateKey = match?.[1]?.trim().replace(/^["']|["']$/g, '');
  const queue = [webAssets];
  while (queue.length) {
    for (const file of readdirSync(queue.pop(), { withFileTypes: true })) {
      const location = join(file.parentPath ?? file.path, file.name);
      if (file.isSymbolicLink()) return false;
      if (file.isDirectory()) queue.push(location);
      else {
        if (/(?:^\.env|\.pem$|\.key$|\.sql$|credentials|secret)/i.test(file.name)) return false;
        if (statSync(location).size > 8 * 1024 * 1024) return false;
        if (privateKey && /\.(?:js|html|json|webmanifest|css)$/i.test(file.name) &&
            readFileSync(location, 'utf8').includes(privateKey)) return false;
      }
    }
  }
  return true;
}
function run() {
  const arg = process.argv.slice(2);
  if (arg.length > 1 || (arg.length === 1 && !arg[0].startsWith('--profile='))) {
    throw new Error('Usage: node scripts/push-staging-release-preflight.mjs [--profile=path]');
  }
  const file = arg[0] ? resolve(arg[0].slice('--profile='.length)) : exampleProfile;
  const profile = JSON.parse(readFileSync(file, 'utf8'));
  const migrationNames = currentMigrations();
  const dirty = exec('git', ['status', '--porcelain=v1', '--untracked-files=normal']);
  const excluded = exec('git', ['check-ignore', 'apps/api/.env']);
  const example = readFileSync(join(root, 'infrastructure', 'staging', 'staging.env.example'), 'utf8');
  const safeTemplate = example.includes('PUSH_SUBSCRIPTIONS_ENABLED=false') &&
    example.includes('PUSH_DELIVERY_ENABLED=false') &&
    example.includes('__STAGING_DOMAIN__') &&
    example.includes('cpsu_marketplace_staging') &&
    excluded?.includes('apps/api/.env');
  const checks = evaluateReleaseProfile(profile, {
    migrations: migrationNames,
    sourceClean: dirty !== null && dirty.trim().length === 0,
    builtSafe: safeWebBundle(),
    templatesSafe: safeTemplate,
  });
  console.log('CPSU MARKET — STAGE 6 OFFLINE STAGING RELEASE PREFLIGHT');
  console.log('This command does not deploy, migrate, send push, access DNS, or modify files.');
  console.log('Repository migration inventory (review every SQL file):');
  for (const name of migrationNames) {
    const sha = createHash('sha256')
      .update(readFileSync(join(migrationDir, name, 'migration.sql')))
      .digest('hex').slice(0, 12);
    console.log('  ' + name + '  sha256:' + sha + '…');
  }
  console.log('Checks:');
  for (const c of checks) console.log((c.ok ? 'PASS    ' : 'BLOCKED ') + c.label +
    (c.ok ? '' : ' — ' + c.detail));
  const blocked = checks.filter(x => !x.ok).length;
  console.log('Result: ' + (checks.length - blocked) + '/' + checks.length + ' passed; ' +
    blocked + ' release gate(s) blocked.');
  console.log('Public deployment and real push delivery remain independently gated even after local PASS.');
  if (blocked > 0) process.exitCode = 2;
}
const launched = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (launched) {
  try { run(); } catch (error) {
    console.error('PREFLIGHT ERROR: ' + (error instanceof Error ? error.message : 'unknown'));
    process.exitCode = 1;
  }
}
