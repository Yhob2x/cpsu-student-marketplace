import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { GoogleDriveStorage, validDriveFileId } from '../src/google-drive-storage.js';
import { driveMediaId, localMediaFile } from '../src/media-storage.js';

const fileId = 'file_123456789abcdef';
const folderId = 'folder_123456789abcdef';
const filename = 'a'.repeat(32) + '.webp';
const bytes = Buffer.from('synthetic sanitized image bytes');
const credentials = { clientId: 'client-test', clientSecret: 'secret-private-test', refreshToken: 'refresh-private-test', folderId };

function mockDrive(corrupt = false) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes('oauth2.googleapis.com/token')) {
      expect(init?.method).toBe('POST');
      expect(String(init?.body)).toContain('grant_type=refresh_token');
      return Response.json({ access_token: 'short-lived-token', expires_in: 3600 });
    }
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer short-lived-token');
    if (url.includes('upload/drive/v3/files')) {
      expect(new Headers(init?.headers).get('Content-Type')).toContain('multipart/related');
      const body = Buffer.from(init?.body as Buffer);
      expect(body.includes(bytes)).toBe(true);
      expect(body.toString('latin1')).toContain(folderId);
      expect(body.toString('latin1')).not.toContain('anyone');
      return Response.json({ id: fileId, md5Checksum: corrupt ? 'bad' : createHash('md5').update(bytes).digest('hex'), size: bytes.length });
    }
    if (url.includes('?alt=media')) return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (init?.method === 'POST') return Response.json({ id: folderId });
    throw new Error('Unexpected request: ' + url);
  }) as typeof fetch;
  return { client: new GoogleDriveStorage(credentials, fakeFetch), calls };
}

describe('Private Google Drive listing media', () => {
  test('uploads normalized photos and verifies the Drive checksum, never makes files public', async () => {
    const { client, calls } = mockDrive();
    expect(await client.upload(bytes, filename, 'image/webp')).toBe(fileId);
    expect(calls.filter(c => c.url.includes('oauth2.googleapis.com/token'))).toHaveLength(1);
    expect(await client.download(fileId)).toEqual(bytes);
    await client.delete(fileId);
    expect(calls.filter(c => c.url.includes('oauth2.googleapis.com/token'))).toHaveLength(1);
    expect(calls.every(c => !c.url.includes('permissions'))).toBe(true);
  });

  test('rejects invalid image filenames, types, or storage IDs', async () => {
    const { client } = mockDrive();
    expect(validDriveFileId('../unsafe')).toBe(false);
    expect(driveMediaId('gdrive:' + fileId)).toBe(fileId);
    expect(() => driveMediaId('gdrive:../unsafe')).toThrow();
    expect(() => localMediaFile('../unsafe.png')).toThrow();
    await expect(client.upload(bytes, '../unsafe.webp', 'image/webp')).rejects.toMatchObject({ status: 400 });
    await expect(client.upload(bytes, filename, 'image/svg+xml')).rejects.toMatchObject({ status: 400 });
  });

  test('does not accept unverified stored bytes and cleans failed upload', async () => {
    const { client, calls } = mockDrive(true);
    await expect(client.upload(bytes, filename, 'image/webp')).rejects.toMatchObject({ status: 503 });
    expect(calls.some(c => c.init?.method === 'DELETE')).toBe(true);
  });

  test('can create the app-owned private folder without permission sharing', async () => {
    const { client } = mockDrive();
    expect(await client.createFolder('CPSU Market Listing Photos')).toBe(folderId);
  });

  test('never returns OAuth secrets in a failed authorization error', async () => {
    const fakeFetch = (async () => new Response('rejected', { status: 401 })) as typeof fetch;
    const client = new GoogleDriveStorage(credentials, fakeFetch);
    try { await client.download(fileId); throw new Error('Expected failure'); }
    catch (error) {
      expect((error as Error).message).not.toContain(credentials.clientSecret);
      expect((error as Error).message).not.toContain(credentials.refreshToken);
    }
  });
});
