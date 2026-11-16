/**
 * Wi-Fi LAN-only, iPhone-test HTTPS entry for the CPSU PWA.
 * Never use with production users or a production database.
 * Static PWA preview: 127.0.0.1:4173; isolated test API: 127.0.0.1:4400.
 * No internet tunnel, user sessions in logs, private-key HTTP downloads or bypass TLS.
 */
import { createServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { networkInterfaces, homedir } from 'node:os';
import { isIP } from 'node:net';

if (process.env.CPSU_IPHONE_LAN_QA !== '1' || process.env.NODE_ENV === 'production') {
  throw new Error('CPSU_IPHONE_LAN_QA=1 required. Production mode is refused.');
}
const ip = process.env.CPSU_IPHONE_LAN_IP;
if (!ip || isIP(ip) !== 4 || !/^192\.168\.(?:\d{1,3})\.(?:\d{1,3})$/.test(ip)) {
  throw new Error('Only an explicit private 192.168.x.x IPv4 is allowed.');
}
const localNetwork = Object.values(networkInterfaces()).flat().some(n =>
  n && n.family === 'IPv4' && !n.internal && n.address === ip && n.netmask === '255.255.255.0');
if (!localNetwork) throw new Error('Requested Wi-Fi IP is not a local /24 adapter address.');
const prefix = ip.slice(0, ip.lastIndexOf('.') + 1);
const base = process.env.LOCALAPPDATA;
if (!base) throw new Error('Windows LOCALAPPDATA is required.');
const root = join(base, 'CPSU-Marketplace', 'iphone-lan-https');
const cert = readFileSync(join(root, 'iphone-lan.crt'));
const key = readFileSync(join(root, 'iphone-lan.key'));
const port = 8445;
const allowedHost = ip + ':' + port;
const maxContentLength = 5 * 1024 * 1024;

function reject(res, code, message) {
  res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(message);
}
const server = createServer({ cert, key, minVersion: 'TLSv1.2' }, (req, res) => {
  const client = req.socket.remoteAddress ?? '';
  if (client !== ip && !client.startsWith(prefix)) {
    return reject(res, 403, 'Only devices on the same private Wi-Fi subnet may connect.');
  }
  if (req.headers.host !== allowedHost) return reject(res, 421, 'Wrong local HTTPS host.');
  if (typeof req.url !== 'string' || !req.url.startsWith('/') || req.url.startsWith('//')) {
    return reject(res, 400, 'Invalid request path.');
  }
  if (!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(req.method ?? '')) {
    return reject(res, 405, 'Method not supported.');
  }
  const length = Number(req.headers['content-length'] ?? 0);
  if (!Number.isFinite(length) || length > maxContentLength) {
    return reject(res, 413, 'Local QA request too large.');
  }
  const isApi = /^\/(api(?:\/|\?|$)|health(?:\?|$))/.test(req.url);
  const upstreamPort = isApi ? 4400 : 4173;
  // Do not trust client-supplied proxy headers. API sees only controlled HTTPS origin.
  const headers = { ...req.headers };
  for (const name of Object.keys(headers)) {
    if (name.startsWith('x-forwarded-') || name === 'forwarded') delete headers[name];
  }
  headers.host = '127.0.0.1:' + upstreamPort;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-host'] = allowedHost;
  headers['x-forwarded-for'] = client;
  const upstream = httpRequest({
    hostname: '127.0.0.1', port: upstreamPort, path: req.url,
    method: req.method, headers, timeout: 8000,
  }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('QA upstream timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) reject(res, 502, 'Local QA service is unavailable.');
    else res.destroy();
  });
  req.pipe(upstream);
});
server.listen(port, ip, () => {
  console.log('CPSU iPhone LAN HTTPS QA ready at https://' + allowedHost + '/');
  console.log('LAN-only /24; isolated API on 127.0.0.1:4400; static preview on 127.0.0.1:4173.');
  console.log('Use only synthetic accounts; no production release, tunnels or outbound push.');
});
