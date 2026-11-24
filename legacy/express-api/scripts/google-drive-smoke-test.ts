import { createHash, randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { googleDriveFromEnv } from '../src/media-storage.js';

// Synthetic content only. Does NOT query or mutate actual listing media/database.
// Creates one temporary private Drive file, verifies byte-for-byte retrieval,
// and deletes it even when a check fails.
const image = await sharp({
  create: { width: 12, height: 12, channels: 3, background: { r: 45, g: 100, b: 75 } },
}).webp().toBuffer();
const name = randomBytes(16).toString('hex') + '.webp';
const drive = googleDriveFromEnv();
let id: string | undefined;
let succeeded = false;
try {
  id = await drive.upload(image, name, 'image/webp');
  const retrieved = await drive.download(id);
  if (createHash('sha256').update(image).digest('hex') !==
      createHash('sha256').update(retrieved).digest('hex')) {
    throw new Error('synthetic_checksum_mismatch');
  }
  succeeded = true;
  console.log('Google Drive synthetic upload/download: PASS');
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'synthetic_io_failed';
  console.error('Google Drive synthetic upload/download: FAIL (' + code + ')');
} finally {
  if (id) {
    try {
      await drive.delete(id);
      console.log('Google Drive synthetic file cleanup: PASS');
    } catch {
      console.error('Google Drive synthetic file cleanup: FAILED (manually inspect app folder for test file)');
      succeeded = false;
    }
  }
}
if (!succeeded) process.exitCode = 1;
