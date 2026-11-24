import { describe, expect, test } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { sanitizeListingImage } from '../src/upload-security.js';

const sample = (filePath: string, mimetype: string) =>
  ({ path: filePath, mimetype }) as Express.Multer.File;

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cpsu-image-safety-'));
  try { await run(dir); } finally { await fs.rm(dir, { recursive: true, force: true }); }
}

describe('untrusted photo sanitation (local synthetic files only)', () => {
  test('decodes JPEG, removes EXIF and writes a standalone WebP', async () => {
    await withTempDir(async dir => {
      const original = await sharp({
        create: { width: 64, height: 48, channels: 3, background: '#829b27' },
      }).jpeg().withExif({ IFD0: { Artist: 'Synthetic test author' } }).toBuffer();
      expect((await sharp(original).metadata()).exif).toBeDefined();
      const input = path.join(dir, 'test.upload');
      await fs.writeFile(input, original);
      const result = await sanitizeListingImage(sample(input, 'image/jpeg'), dir);
      expect(result.mimeType).toBe('image/webp');
      expect(result.mediaPath.endsWith('.webp')).toBe(true);
      const clean = await sharp(await fs.readFile(path.join(dir, result.mediaPath))).metadata();
      expect(clean.format).toBe('webp');
      expect(clean.width).toBe(64);
      expect(clean.height).toBe(48);
      expect(clean.exif).toBeUndefined();
      expect(await fs.readdir(dir)).toEqual([result.mediaPath]);
    });
  });

  test('seller profile picture is a square, metadata-free WebP and the original is discarded', async () => {
    await withTempDir(async dir => {
      const original = await sharp({
        create: { width: 800, height: 500, channels: 3, background: '#28543c' },
      }).png().withExif({ IFD0: { Artist: 'Synthetic avatar uploader' } }).toBuffer();
      const input = path.join(dir, 'avatar.upload');
      await fs.writeFile(input, original);
      const result = await sanitizeListingImage(sample(input, 'image/png'), dir, { avatar: true });
      const image = await sharp(await fs.readFile(path.join(dir, result.mediaPath))).metadata();
      expect(image.format).toBe('webp');
      expect(image.width).toBe(512);
      expect(image.height).toBe(512);
      expect(image.exif).toBeUndefined();
      expect(await fs.readdir(dir)).toEqual([result.mediaPath]);
    });
  });

  test('rejects PNG bytes falsely declared to be JPEG and cleans up', async () => {
    await withTempDir(async dir => {
      const bytes = await sharp({
        create: { width: 32, height: 32, channels: 3, background: '#ffcc88' },
      }).png().toBuffer();
      const input = path.join(dir, 'disguised.upload');
      await fs.writeFile(input, bytes);
      await expect(sanitizeListingImage(sample(input, 'image/jpeg'), dir))
        .rejects.toMatchObject({ status: 400, code: 'invalid_image' });
      expect(await fs.readdir(dir)).toHaveLength(0);
    });
  });

  test('rejects non-image bytes with a fake image MIME type and cleans up', async () => {
    await withTempDir(async dir => {
      const input = path.join(dir, 'bad.upload');
      await fs.writeFile(input, '<script>alert("not an image")</script>');
      await expect(sanitizeListingImage(sample(input, 'image/png'), dir))
        .rejects.toMatchObject({ status: 400, code: 'invalid_image' });
      expect(await fs.readdir(dir)).toHaveLength(0);
    });
  });
});
