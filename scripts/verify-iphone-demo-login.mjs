/** Test-only HTTPS sign-in for two synthetic demo accounts; never prints tokens. */
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { networkInterfaces } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ip = process.env.CPSU_IPHONE_LAN_IP;
const local = Object.values(networkInterfaces()).flat().some(n =>
  n && n.family === 'IPv4' && n.address === ip && n.netmask === '255.255.255.0');
if (process.env.CPSU_IPHONE_LOGIN_VERIFY !== '1' || !local)
  throw new Error('Explicit private-Wi-Fi test guard required.');
const ca = readFileSync(join(process.env.LOCALAPPDATA || '', 'CPSU-Marketplace', 'iphone-lan-https', 'root-ca.pem'));
async function send(path, method = 'GET', data, token) {
  const body = data ? JSON.stringify(data) : '';
  return await new Promise((resolve, reject) => {
    const req = request('https://' + ip + ':8445' + path, {
      method, ca, rejectUnauthorized: true,
      headers: {
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch { reject(new Error('Unexpected API response format')); }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}
for (const email of ['buyer@dev.test', 'seller@dev.test']) {
  const auth = await send('/api/v1/auth/login', 'POST', { email, password: 'DevPassword!123' });
  assert.equal(auth.status, 200, 'Demo login failed: ' + email);
  assert.equal(typeof auth.body.accessToken, 'string');
  const profile = await send('/api/v1/me', 'GET', undefined, auth.body.accessToken);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.email, email);
  assert.equal(profile.body.affiliations[0]?.status, 'verified');
  assert.deepEqual(profile.body.roles, []);
  console.log('PASS ' + email + ': login HTTP 200 and authenticated profile HTTP 200');
}
console.log('Both synthetic HTTPS logins verified. No tokens or cookies printed.');
