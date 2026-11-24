/**
 * Isolated localhost HTTPS reverse proxy for staging PWA browser-emulation checks.
 * No public exposure, TLS trust installation, remote tunneling, or live deployment.
 *
 * Preparation: localhost TLS test certificate in %LOCALAPPDATA%/CPSU-Marketplace/staging-tls
 * Run with CPSU_LOCAL_PUSH_QA=1 after starting:
 *   Vite production preview on 127.0.0.1:4173
 *   Isolated test-mode Express API on 127.0.0.1:4400
 * Then visit https://localhost:8443 with a test-only Chrome profile that explicitly
 * accepts the temporary self-signed certificate. Do NOT use this for real students.
 */
import { createServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CPSU_LOCAL_PUSH_QA !== '1') {
  throw new Error('Set CPSU_LOCAL_PUSH_QA=1 for explicitly authorized localhost-only QA.');
}
const local = process.env.LOCALAPPDATA;
if (!local) throw new Error('Windows LOCALAPPDATA is unavailable.');
const base = join(local, 'CPSU-Marketplace', 'staging-tls');
const cert = join(base, 'localhost.crt');
const key = join(base, 'localhost.key');
if (!existsSync(cert) || !existsSync(key)) throw new Error('Missing isolated localhost-only TLS certificate.');

const server = createServer({ cert: readFileSync(cert), key: readFileSync(key) }, (req, res) => {
  const path = req.url ?? '/';
  if (req.headers.host !== 'localhost:8443' && req.headers.host !== '127.0.0.1:8443') {
    res.writeHead(421, { 'Content-Type': 'text/plain' });
    res.end('Localhost-only test gateway.');
    return;
  }
  if (!path.startsWith('/') || path.startsWith('//')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid test URL.');
    return;
  }
  const upstreamPort = /^\/api(?:\/|\?|$)/.test(path) ? 4400 : 4173;
  const headers = {
    ...req.headers,
    host: '127.0.0.1:' + upstreamPort,
    'x-forwarded-proto': 'https',
    'x-forwarded-host': 'localhost:8443',
  };
  const upstream = httpRequest({
    hostname: '127.0.0.1', port: upstreamPort, path,
    method: req.method, headers, timeout: 6000,
  }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Local test upstream timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Local test service unavailable.');
  });
  req.pipe(upstream);
});
server.listen(8443, '127.0.0.1', () => {
  console.log('CPSU local HTTPS PWA QA: https://localhost:8443 (loopback only; self-signed test certificate).');
  console.log('API routes target 127.0.0.1:4400; preview assets target 127.0.0.1:4173.');
  console.log('Never expose this test proxy to a LAN, the internet, or real students.');
});
