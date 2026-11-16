/**
 * Verify LAN HTTPS with CA chain validation ON; never use insecure -k or accept self-signed bypass.
 * Does not send credentials, create DB rows, request push consent, or mutate app data.
 */
import assert from 'node:assert/strict';
import { get } from 'node:https';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces } from 'node:os';

const ip = process.env.CPSU_IPHONE_LAN_IP;
const knownLocal = Object.values(networkInterfaces()).flat().some(n =>
  n && n.family === 'IPv4' && n.address === ip && n.netmask === '255.255.255.0');
if (process.env.CPSU_IPHONE_LAN_QA !== '1' || !ip || !knownLocal) {
  throw new Error('LAN QA guard or local Wi-Fi IP not satisfied.');
}
const ca = readFileSync(join(process.env.LOCALAPPDATA ?? '', 'CPSU-Marketplace', 'iphone-lan-https', 'root-ca.pem'));
const base = 'https://' + ip + ':8445';
function fetch(path, host) {
  return new Promise((resolve, reject) => {
    const req = get(base + path, { ca, rejectUnauthorized: true,
      // Preserve a verified SAN while intentionally testing a wrong HTTP Host header.
      servername: host ? 'localhost' : undefined,
      headers: host ? { host } : undefined,
      timeout: 7500,
    }, (res) => {
      const chunks = [];
      res.on('data', b => chunks.push(b));
      res.on('end', () => resolve({
        status: res.statusCode, bytes: Buffer.concat(chunks),
        authenticated: req.socket.authorized === true,
      }));
    });
    req.on('timeout', () => req.destroy(new Error('HTTPS QA timeout')));
    req.on('error', reject);
  });
}
for (const [path, status] of [
  ['/', 200],
  ['/manifest.webmanifest', 200],
  ['/sw.js', 200],
  ['/icons/apple-touch-icon.png', 200],
  ['/health', 200],
  ['/api/v1/listings?pageSize=1', 200],
  ['/api/v1/push/config', 401],
]) {
  const r = await fetch(path);
  assert.equal(r.authenticated, true, 'CA trust validation failed: ' + path);
  assert.equal(r.status, status, 'Unexpected status for ' + path);
  if (path === '/') assert.match(r.bytes.toString(), /CPSU Student Marketplace/i);
  if (path === '/manifest.webmanifest') {
    const manifest = JSON.parse(r.bytes.toString());
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.short_name, 'CPSU Market');
  }
  if (path === '/health') assert.equal(JSON.parse(r.bytes.toString()).ok, true);
  console.log('PASS ' + path + ': HTTP ' + r.status + ' with verified TLS');
}
const wrongHost = await fetch('/', 'malicious.invalid:8445');
assert.equal(wrongHost.status, 421);
console.log('PASS rejected unexpected Host header (421)');
console.log('LAN QA HTTPS verification PASSED, no TLS bypass and no real-student data.');
