// Test real local sanitization/screening without student files or database writes.
import { createRequire } from 'node:module';
const sharp = createRequire(new URL('../photo-service/package.json', import.meta.url))('sharp');
const url = process.env.PHOTO_SERVICE_URL || 'http://127.0.0.1:4310';
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('Only a local service may be tested');
const input = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#8da99b' } }).png().toBuffer();
const headers = { 'X-Photo-Service-Token': process.env.PHOTO_SERVICE_TOKEN || '', 'Content-Type': 'application/octet-stream' };
const bad = await fetch(url + '/sanitize?mime=image/png', { method: 'POST', headers, body: new Uint8Array([0,1,2]), signal: AbortSignal.timeout(15000) });
if (bad.status !== 400) throw new Error('Invalid image was not rejected: ' + bad.status);
const res = await fetch(url + '/sanitize?mime=image/png', { method: 'POST', headers, body: input, signal: AbortSignal.timeout(15000) });
if (!res.ok) throw new Error('Sanitize failed: ' + res.status);
const output = Buffer.from(await res.arrayBuffer());
if ((await sharp(output).metadata()).format !== 'webp') throw new Error('Output is not sanitized WebP');
console.log('PASS local photo sanitizer: valid image re-encoded; fake image rejected');
const screen = await fetch(url + '/screen', { method: 'POST', headers, body: output, signal: AbortSignal.timeout(90000) });
if (!screen.ok) throw new Error('Screening service returned: ' + screen.status);
const verdict = (await screen.json()).verdict;
if (!['safe','explicit','uncertain'].includes(verdict)) throw new Error('Invalid screening result');
console.log('PASS local photo model returned a valid verdict: ' + verdict);
