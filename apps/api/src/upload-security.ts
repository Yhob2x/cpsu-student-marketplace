import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { HttpError } from './http.js';

// File signatures and full decoding matter: the browser-supplied MIME type is
// not proof of file contents. This is file safety, NOT NSFW classification.
const FORMAT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_PIXELS = 24_000_000;
const MAX_STORED_BYTES = 3 * 1024 * 1024;

export async function sanitizeListingImage(file: Express.Multer.File, uploadDir: string, options: { avatar?: boolean } = {}) {
  let storedName: string | null = null;
  try {
    const image = sharp(file.path, { failOn: 'warning', limitInputPixels: MAX_PIXELS });
    const metadata = await image.metadata();
    if (metadata.format !== FORMAT_BY_MIME[file.mimetype] ||
        !metadata.width || !metadata.height ||
        metadata.width * metadata.height > MAX_PIXELS ||
        (metadata.pages ?? 1) > 1) {
      throw new HttpError(400, 'invalid_image', 'Use a valid, single-frame JPEG, PNG or WebP photo up to 24 megapixels.');
    }
    // Re-decode/re-encode as a still image. Sharp removes EXIF, GPS and other
    // source metadata by default and drops extraneous file content.
    const output = await sharp(file.path, { failOn: 'warning', limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(options.avatar ? { width: 512, height: 512, fit: 'cover', position: 'centre' } :
        { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    if (output.byteLength > MAX_STORED_BYTES) {
      throw new HttpError(400, 'invalid_image', 'The processed image is too large. Try a smaller photo.');
    }
    storedName = crypto.randomBytes(16).toString('hex') + '.webp';
    await fs.writeFile(path.join(uploadDir, storedName), output, { flag: 'wx', mode: 0o600 });
    return { mediaPath: storedName, mimeType: 'image/webp' };
  } catch (error) {
    if (storedName) await fs.unlink(path.join(uploadDir, storedName)).catch(() => {});
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'invalid_image', 'The image could not be verified. Use a valid JPEG, PNG or WebP photo.');
  } finally {
    // Never leave the original, untrusted upload on the server.
    await fs.unlink(file.path).catch(() => {});
  }
}
