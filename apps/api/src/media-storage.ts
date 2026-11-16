import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';
import { HttpError } from './http.js';
import { GoogleDriveStorage, validDriveFileId } from './google-drive-storage.js';

const DRIVE_PREFIX = 'gdrive:';
const SAFE_LOCAL_NAME = /^[a-f0-9]{32}\.(?:webp|jpg|jpeg|png)$/;
let drive: GoogleDriveStorage | null = null;

export function driveMediaId(mediaPath: string): string | null {
  if (!mediaPath.startsWith(DRIVE_PREFIX)) return null;
  const id = mediaPath.slice(DRIVE_PREFIX.length);
  if (!validDriveFileId(id)) throw new HttpError(404, 'not_found');
  return id;
}

export function localMediaFile(mediaPath: string): string {
  if (!SAFE_LOCAL_NAME.test(mediaPath)) throw new HttpError(404, 'not_found');
  return path.resolve(env.UPLOAD_DIR, mediaPath);
}

export function googleDriveFromEnv(): GoogleDriveStorage {
  if (!env.GOOGLE_DRIVE_CLIENT_ID || !env.GOOGLE_DRIVE_CLIENT_SECRET || !env.GOOGLE_DRIVE_REFRESH_TOKEN)
    throw new HttpError(503, 'media_storage_unavailable', 'Photo storage has not been connected.');
  return drive ??= new GoogleDriveStorage({
    clientId: env.GOOGLE_DRIVE_CLIENT_ID, clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN, folderId: env.GOOGLE_DRIVE_FOLDER_ID,
  });
}

export async function storeSanitizedMedia(safe: { mediaPath: string; mimeType: string }) {
  if (env.MEDIA_STORAGE !== 'google_drive') return safe;
  const filename = safe.mediaPath;
  const location = localMediaFile(filename);
  try {
    const content = await fs.readFile(location);
    const id = await googleDriveFromEnv().upload(content, filename, safe.mimeType);
    return { mediaPath: DRIVE_PREFIX + id, mimeType: safe.mimeType };
  } finally {
    // The original upload is already deleted by Sharp sanitization. A cleaned
    // local intermediate must never be left on disk when using Drive mode.
    await fs.unlink(location).catch(() => {});
  }
}

export async function deleteStoredMedia(mediaPath: string): Promise<void> {
  const id = driveMediaId(mediaPath);
  if (id) await googleDriveFromEnv().delete(id);
  else await fs.unlink(localMediaFile(mediaPath)).catch(error => {
    if (error?.code !== 'ENOENT') throw error;
  });
}

export async function readDriveMedia(mediaPath: string): Promise<Buffer> {
  const id = driveMediaId(mediaPath);
  if (!id) throw new HttpError(404, 'not_found');
  return googleDriveFromEnv().download(id);
}
