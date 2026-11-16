import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

// The Drive account must be authorized by the operator, not by each student.
// Files are PRIVATE; browsers only read them through our existing authorized API.
export type DriveCredentials = { clientId: string; clientSecret: string; refreshToken: string; folderId?: string };
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const MAX_MEDIA_BYTES = 3 * 1024 * 1024;
const FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;

export function validDriveFileId(value: string) {
  return FILE_ID.test(value);
}

export class GoogleDriveStorage {
  private cachedToken: { value: string; until: number } | null = null;
  constructor(private readonly credentials: DriveCredentials, private readonly fetcher: typeof fetch = fetch) {}

  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.until > Date.now() + 60_000) return this.cachedToken.value;
    let response: Response;
    try {
      response = await this.fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST', signal: AbortSignal.timeout(15_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          refresh_token: this.credentials.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
    } catch { throw new HttpError(503, 'media_storage_unavailable', 'Photo storage is temporarily unavailable.'); }
    if (!response.ok) throw new HttpError(503, 'media_storage_unavailable', 'Photo storage authentication is unavailable.');
    const payload = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof payload.access_token !== 'string' || !payload.access_token)
      throw new HttpError(503, 'media_storage_unavailable', 'Photo storage authentication is unavailable.');
    const ttl = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
    this.cachedToken = { value: payload.access_token, until: Date.now() + Math.max(60, ttl) * 1000 };
    return payload.access_token;
  }

  private async request(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    try {
      return await this.fetcher(url, {
        ...options, signal: AbortSignal.timeout(25_000),
        headers: { ...options.headers, Authorization: `Bearer ${token}` },
      });
    } catch { throw new HttpError(503, 'media_storage_unavailable', 'Photo storage is temporarily unavailable.'); }
  }

  async upload(content: Buffer, filename: string, mimeType: string): Promise<string> {
    if (!this.credentials.folderId || !validDriveFileId(this.credentials.folderId))
      throw new HttpError(503, 'media_storage_unavailable', 'Photo storage is not configured.');
    if (!content.length || content.length > MAX_MEDIA_BYTES || !/^[a-f0-9]{32}\.webp$/.test(filename) || mimeType !== 'image/webp')
      throw new HttpError(400, 'invalid_image');
    return this.uploadToFolder(content, filename, mimeType, this.credentials.folderId);
  }

  // Also used by the explicit, backup-gated legacy migration for original JPEG/PNG files.
  async uploadToFolder(content: Buffer, filename: string, mimeType: string, folderId: string): Promise<string> {
    if (!validDriveFileId(folderId) || !/^[a-f0-9]{32}\.(webp|jpg|jpeg|png)$/.test(filename) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
        content.length === 0 || content.length > MAX_MEDIA_BYTES)
      throw new HttpError(400, 'invalid_image');
    const boundary = 'cpsu_' + createHash('sha256').update(content).digest('hex').slice(0, 32);
    const metadata = JSON.stringify({ name: filename, parents: [folderId], mimeType, description: 'CPSU Marketplace listing image' });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      content, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await this.request(`${UPLOAD_API}?uploadType=multipart&fields=id,md5Checksum,size`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
    });
    if (!response.ok) throw new HttpError(503, 'media_storage_unavailable', 'Photo storage upload failed.');
    const result = await response.json() as { id?: unknown; md5Checksum?: unknown; size?: unknown };
    if (typeof result.id !== 'string' || !validDriveFileId(result.id))
      throw new HttpError(503, 'media_storage_unavailable', 'Photo storage did not confirm the upload.');
    const checksum = createHash('md5').update(content).digest('hex');
    if (result.md5Checksum !== checksum || String(result.size) !== String(content.length)) {
      await this.delete(result.id).catch(() => {});
      throw new HttpError(503, 'media_storage_unavailable', 'Photo storage integrity verification failed.');
    }
    return result.id;
  }

  async download(fileId: string): Promise<Buffer> {
    if (!validDriveFileId(fileId)) throw new HttpError(404, 'not_found');
    const response = await this.request(`${DRIVE_API}/${fileId}?alt=media`);
    if (!response.ok) throw new HttpError(503, 'media_storage_unavailable', 'Photo storage could not load this image.');
    const reportedSize = Number(response.headers.get('content-length') || 0);
    if (reportedSize > MAX_MEDIA_BYTES) throw new HttpError(503, 'media_storage_unavailable');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_MEDIA_BYTES) throw new HttpError(503, 'media_storage_unavailable');
    return buffer;
  }

  async delete(fileId: string): Promise<void> {
    if (!validDriveFileId(fileId)) throw new HttpError(404, 'not_found');
    const response = await this.request(`${DRIVE_API}/${fileId}`, { method: 'DELETE' });
    if (!response.ok && response.status !== 404)
      throw new HttpError(503, 'media_storage_unavailable', 'Photo storage cleanup failed.');
  }

  async createFolder(name: string): Promise<string> {
    const response = await this.request(`${DRIVE_API}?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
    });
    if (!response.ok) throw new HttpError(503, 'media_storage_unavailable', 'Photo folder creation failed.');
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== 'string' || !validDriveFileId(result.id))
      throw new HttpError(503, 'media_storage_unavailable', 'Photo folder creation was not confirmed.');
    return result.id;
  }
}
