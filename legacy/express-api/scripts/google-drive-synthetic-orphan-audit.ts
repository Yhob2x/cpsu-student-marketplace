import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { env } from '../src/env.js';
import { validDriveFileId } from '../src/google-drive-storage.js';

// Examine only the exact synthetic test image, recently uploaded, in the
// configured private Drive folder. Default read-only; no user files touched.
const execute = process.argv.includes('--delete-confirmed-synthetic-only');
const folder = env.GOOGLE_DRIVE_FOLDER_ID;
if (!folder || !validDriveFileId(folder) || !env.GOOGLE_DRIVE_CLIENT_ID ||
    !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN)
  throw new Error('Private Drive configuration missing.');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ client_id: env.GOOGLE_DRIVE_CLIENT_ID,
    client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
    grant_type: 'refresh_token' }),
});
if (!tokenResponse.ok) throw new Error('Google Drive authorization failed.');
const { access_token: token } = await tokenResponse.json() as { access_token: string };
const headers = { Authorization: 'Bearer ' + token };
const png = await sharp({ create: { width: 40, height: 30, channels: 3,
  background: '#315f45' } }).png().toBuffer();
const expected = await sharp(png, { failOn: 'warning', limitInputPixels: 24_000_000 })
  .rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 82, effort: 4 }).toBuffer();
const expectedMd5 = createHash('md5').update(expected).digest('hex');
const cutoff = Date.now() - 60 * 60 * 1000;
let scanned = 0;
let matches: string[] = [];
let pageToken = '';
for (let page = 0; page < 30; page++) {
  const params = new URLSearchParams({
    q: `'${folder}' in parents and trashed = false and mimeType = 'image/webp'`,
    fields: 'nextPageToken,files(id,name,size,md5Checksum,createdTime)',
    page_size: '1000',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const response = await fetch('https://www.googleapis.com/drive/v3/files?' + params.toString(), { headers });
  if (!response.ok) throw new Error('Cannot inspect app-owned media folder.');
  const result = await response.json() as {
    nextPageToken?: string; files?: {id:string;name:string;size:string;md5Checksum?:string;createdTime:string}[]
  };
  for (const file of result.files ?? []) {
    scanned++;
    if (/^[a-f0-9]{32}\.webp$/.test(file.name) && validDriveFileId(file.id) &&
        file.md5Checksum === expectedMd5 && Number(file.size) === expected.length &&
        Date.parse(file.createdTime) > cutoff) {
      const read = await fetch('https://www.googleapis.com/drive/v3/files/' + file.id + '?alt=media', { headers });
      if (!read.ok) throw new Error('Cannot verify suspected synthetic orphan.');
      const bytes = Buffer.from(await read.arrayBuffer());
      if (createHash('sha256').update(bytes).digest('hex') === createHash('sha256').update(expected).digest('hex'))
        matches.push(file.id);
    }
  }
  if (!result.nextPageToken) break;
  pageToken = result.nextPageToken;
}
console.log('Recent exact synthetic orphan candidates: ' + matches.length + '; folder entries inspected: ' + scanned);
if (execute) {
  if (matches.length !== 1) throw new Error('Refusing cleanup unless exactly one synthetic orphan matches.');
  const response = await fetch('https://www.googleapis.com/drive/v3/files/' + matches[0], {
    method: 'DELETE', headers,
  });
  if (!response.ok && response.status !== 404) throw new Error('Synthetic orphan cleanup failed.');
  console.log('Exact synthetic orphan cleanup: PASS');
} else {
  console.log('READ_ONLY: no Drive files changed.');
}
