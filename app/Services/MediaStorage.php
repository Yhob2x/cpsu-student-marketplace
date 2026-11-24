<?php

namespace App\Services;

use App\Support\ApiError;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class MediaStorage
{
    private const DRIVE_PREFIX = 'gdrive:';

    public function __construct(private readonly GoogleDriveStorage $drive)
    {
    }

    public function driveId(string $mediaPath): ?string
    {
        if (! str_starts_with($mediaPath, self::DRIVE_PREFIX)) {
            return null;
        }

        $id = substr($mediaPath, strlen(self::DRIVE_PREFIX));
        if (! GoogleDriveStorage::validFileId($id)) {
            throw new ApiError(404, 'not_found');
        }

        return $id;
    }

    /** Only generated file names are accepted, so stored paths cannot escape the upload folder. */
    public function localFile(string $mediaPath): string
    {
        if (preg_match('/^[a-f0-9]{32}\.(?:webp|jpg|jpeg|png)\z/', $mediaPath) !== 1) {
            throw new ApiError(404, 'not_found');
        }

        return rtrim((string) config('marketplace.upload_dir'), '/\\').DIRECTORY_SEPARATOR.$mediaPath;
    }

    /** Writes sanitized bytes with a random name and owner-only permissions. */
    public function writeSanitized(string $bytes): array
    {
        $directory = (string) config('marketplace.upload_dir');
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new ApiError(503, 'media_storage_unavailable', 'Photo storage is temporarily unavailable.');
        }

        $name = bin2hex(random_bytes(16)).'.webp';
        $path = $this->localFile($name);
        $handle = @fopen($path, 'xb');
        if ($handle === false) {
            throw new ApiError(503, 'media_storage_unavailable', 'Photo storage is temporarily unavailable.');
        }

        $written = fwrite($handle, $bytes);
        fclose($handle);
        if ($written !== strlen($bytes)) {
            @unlink($path);
            throw new ApiError(503, 'media_storage_unavailable', 'Photo storage is temporarily unavailable.');
        }
        @chmod($path, 0600);

        return ['mediaPath' => $name, 'mimeType' => 'image/webp'];
    }

    public function storeSanitized(array $safe): array
    {
        if (config('marketplace.media_storage') !== 'google_drive') {
            return $safe;
        }

        $location = $this->localFile($safe['mediaPath']);
        try {
            $id = $this->drive->upload((string) file_get_contents($location), $safe['mediaPath'], $safe['mimeType']);

            return ['mediaPath' => self::DRIVE_PREFIX.$id, 'mimeType' => $safe['mimeType']];
        } finally {
            // A cleaned local intermediate must never remain on disk in Drive mode.
            @unlink($location);
        }
    }

    public function delete(string $mediaPath): void
    {
        $id = $this->driveId($mediaPath);
        if ($id !== null) {
            $this->drive->delete($id);

            return;
        }

        $file = $this->localFile($mediaPath);
        if (is_file($file) && ! unlink($file)) {
            throw new \RuntimeException('Stored media could not be deleted.');
        }
    }

    public function deleteQuietly(string $mediaPath): void
    {
        try {
            $this->delete($mediaPath);
        } catch (\Throwable) {
            report(new \RuntimeException('Stored media cleanup failed.'));
        }
    }

    public function response(string $mediaPath, string $mimeType): Response
    {
        $headers = ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Type' => $mimeType];
        $id = $this->driveId($mediaPath);
        if ($id !== null) {
            return response($this->drive->download($id), 200, $headers);
        }

        $file = $this->localFile($mediaPath);
        if (! is_file($file)) {
            throw new ApiError(404, 'not_found');
        }

        // BinaryFileResponse defaults to public caching, which must never apply to student photos.
        return new BinaryFileResponse($file, 200, $headers, false);
    }
}
