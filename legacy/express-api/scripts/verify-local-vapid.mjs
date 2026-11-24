// Read-only local VAPID configuration validation. Prints status only, never secret values.
import { createECDH, createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const envPath = join(import.meta.dirname, '..', '.env');
if (!existsSync(envPath)) throw new Error('API .env missing.');
if (process.env.NODE_ENV === 'production') throw new Error('This is a local-only verification.');
const uri = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1', '::1'].includes(uri.hostname) ||
    decodeURIComponent(uri.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('Unexpected DB target; refuse to inspect configuration.');
}
const raw = readFileSync(envPath, 'utf8');
const field = (name) => {
  const match = raw.match(new RegExp('^\\s*' + name + '\\s*=\\s*(.*)$', 'm'));
  const value = match?.[1]?.trim() ?? '';
  return /^["'].*["']$/.test(value) ? value.slice(1, -1) : value;
};
const publicKey = field('VAPID_PUBLIC_KEY');
const privateKey = field('VAPID_PRIVATE_KEY');
const subject = field('VAPID_SUBJECT');
if (!/^[a-zA-Z0-9_-]{87}$/.test(publicKey) || !/^[a-zA-Z0-9_-]{43}$/.test(privateKey)) {
  throw new Error('VAPID key material has an invalid format.');
}
const ecdh = createECDH('prime256v1');
ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'));
if (ecdh.getPublicKey().toString('base64url') !== publicKey) {
  throw new Error('VAPID public/private keys do not match.');
}
if (subject !== 'https://localhost:8443/') {
  throw new Error('Local-only VAPID contact changed; manually review rather than overwriting it.');
}
const ignore = spawnSync('git', ['check-ignore', '-q', envPath], {
  cwd: join(import.meta.dirname, '..', '..', '..'), stdio: 'ignore', windowsHide: true,
});
if (ignore.status !== 0) throw new Error('API .env is not Git-ignored.');
console.log('PASS: Valid matching P-256 VAPID keypair, Git-ignored .env, localhost-only contact.');
console.log('Public-key SHA-256 short fingerprint: ' + createHash('sha256').update(publicKey).digest('hex').slice(0,12));
console.log('No private key or database credentials printed. Replace test contact before public staging.');
