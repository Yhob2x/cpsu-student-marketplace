import type { Response } from 'express';
import { driveMediaId, localMediaFile, readDriveMedia } from './media-storage.js';

export async function sendHomePageImage(res: Response, mediaPath: string) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (driveMediaId(mediaPath)) {
    const bytes = await readDriveMedia(mediaPath);
    return res.type('image/webp').send(bytes);
  }
  return res.type('image/webp').sendFile(localMediaFile(mediaPath));
}
