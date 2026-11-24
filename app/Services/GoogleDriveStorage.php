<?php

namespace App\Services;

use App\Support\ApiError;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/** Private operator-owned Drive storage. Browsers read files only through the authorized API. */
class GoogleDriveStorage
{
    private const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

    private const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

    private const MAX_MEDIA_BYTES = 3145728;

    private ?string $token = null;

    private int $tokenUntil = 0;

    public static function validFileId(string $value): bool
    {
        return preg_match('/^[A-Za-z0-9_-]{10,200}\z/', $value) === 1;
    }

    public function upload(string $content, string $filename, string $mimeType): string
    {
        $folderId = (string) config('marketplace.google_drive.folder_id');
        if (! self::validFileId($folderId)) {
            throw $this->unavailable('Photo storage is not configured.');
        }
        if ($content === '' || strlen($content) > self::MAX_MEDIA_BYTES || preg_match('/^[a-f0-9]{32}\.webp\z/', $filename) !== 1 || $mimeType !== 'image/webp') {
            throw new ApiError(400, 'invalid_image');
        }

        $boundary = 'cpsu_'.substr(hash('sha256', $content), 0, 32);
        $metadata = json_encode(['name' => $filename, 'parents' => [$folderId], 'mimeType' => $mimeType, 'description' => 'CPSU Marketplace listing image'], JSON_UNESCAPED_SLASHES);
        $body = "--{$boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{$metadata}\r\n--{$boundary}\r\nContent-Type: {$mimeType}\r\n\r\n{$content}\r\n--{$boundary}--\r\n";

        $response = $this->send(fn ($client) => $client->withBody($body, "multipart/related; boundary={$boundary}")->post(self::UPLOAD_API.'?uploadType=multipart&fields=id,md5Checksum,size'));
        if (! $response->successful()) {
            throw $this->unavailable('Photo storage upload failed.');
        }

        $result = $response->json();
        $id = $result['id'] ?? null;
        if (! is_string($id) || ! self::validFileId($id)) {
            throw $this->unavailable('Photo storage did not confirm the upload.');
        }
        if (($result['md5Checksum'] ?? null) !== md5($content) || (string) ($result['size'] ?? '') !== (string) strlen($content)) {
            try {
                $this->delete($id);
            } catch (ApiError) {
                // The integrity failure below is the error the student needs.
            }
            throw $this->unavailable('Photo storage integrity verification failed.');
        }

        return $id;
    }

    public function download(string $fileId): string
    {
        if (! self::validFileId($fileId)) {
            throw new ApiError(404, 'not_found');
        }

        $response = $this->send(fn ($client) => $client->get(self::DRIVE_API."/{$fileId}?alt=media"));
        if (! $response->successful()) {
            throw $this->unavailable('Photo storage could not load this image.');
        }

        $bytes = $response->body();
        if ($bytes === '' || strlen($bytes) > self::MAX_MEDIA_BYTES) {
            throw new ApiError(503, 'media_storage_unavailable');
        }

        return $bytes;
    }

    public function delete(string $fileId): void
    {
        if (! self::validFileId($fileId)) {
            throw new ApiError(404, 'not_found');
        }

        $response = $this->send(fn ($client) => $client->delete(self::DRIVE_API."/{$fileId}"));
        if (! $response->successful() && $response->status() !== 404) {
            throw $this->unavailable('Photo storage cleanup failed.');
        }
    }

    private function send(callable $request): Response
    {
        $token = $this->accessToken();
        try {
            return $request(Http::withToken($token)->timeout(25));
        } catch (ConnectionException) {
            throw $this->unavailable('Photo storage is temporarily unavailable.');
        }
    }

    private function accessToken(): string
    {
        if ($this->token !== null && $this->tokenUntil > time() + 60) {
            return $this->token;
        }

        $drive = config('marketplace.google_drive');
        if (! $drive['client_id'] || ! $drive['client_secret'] || ! $drive['refresh_token']) {
            throw $this->unavailable('Photo storage has not been connected.');
        }

        try {
            $response = Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/token', [
                'client_id' => $drive['client_id'],
                'client_secret' => $drive['client_secret'],
                'refresh_token' => $drive['refresh_token'],
                'grant_type' => 'refresh_token',
            ]);
        } catch (ConnectionException) {
            throw $this->unavailable('Photo storage is temporarily unavailable.');
        }

        $token = $response->successful() ? $response->json('access_token') : null;
        if (! is_string($token) || $token === '') {
            throw $this->unavailable('Photo storage authentication is unavailable.');
        }

        $ttl = $response->json('expires_in');
        $this->token = $token;
        $this->tokenUntil = time() + max(60, is_numeric($ttl) ? (int) $ttl : 3600);

        return $token;
    }

    private function unavailable(string $message): ApiError
    {
        return new ApiError(503, 'media_storage_unavailable', $message);
    }
}
