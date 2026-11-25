<?php

namespace App\Services;

use App\Support\ApiError;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

/** Calls the private local photo service. Any failure leaves the student's content unchanged. */
class PhotoService
{
    private const MAX_STORED_BYTES = 3145728;

    public function __construct(private readonly MediaStorage $media) {}

    public function sanitize(UploadedFile $file, bool $avatar = false): array
    {
        $path = $file->getRealPath();
        $bytes = (string) file_get_contents($path);
        $mime = (string) $file->getClientMimeType();
        // The untrusted original is removed as soon as it has been read.
        @unlink($path);

        try {
            $response = $this->post('/sanitize?'.http_build_query(['mime' => $mime, 'avatar' => $avatar ? '1' : '0']), $bytes);
        } catch (ConnectionException) {
            throw $this->processingUnavailable();
        }

        if ($response->status() === 400) {
            throw new ApiError(400, 'invalid_image', (string) $response->json('error.message', 'The image could not be verified. Use a valid JPEG, PNG or WebP photo.'));
        }

        $output = $response->successful() ? $response->body() : '';
        if ($output === '' || strlen($output) > self::MAX_STORED_BYTES || substr($output, 0, 4) !== 'RIFF' || substr($output, 8, 4) !== 'WEBP') {
            throw $this->processingUnavailable();
        }

        return $this->media->writeSanitized($output);
    }

    /** Fails closed: only an explicit safe verdict allows a store photo to publish. */
    public function screenAvatar(string $mediaPath): void
    {
        $file = $this->media->localFile($mediaPath);
        if (! is_file($file)) {
            throw $this->screeningUnavailable('Photo safety screening is unavailable. Your current picture is unchanged.');
        }

        try {
            $response = $this->post('/screen', (string) file_get_contents($file));
        } catch (ConnectionException) {
            throw $this->screeningUnavailable();
        }

        if ($response->json('error.code') === 'avatar_screening_busy') {
            throw new ApiError(503, 'avatar_screening_busy', 'Photo screening is busy. Your current picture is unchanged; please try again later.');
        }

        $verdict = $response->successful() ? $response->json('verdict') : null;
        match ($verdict) {
            'safe' => null,
            'explicit' => throw new ApiError(422, 'avatar_explicit_content', 'This picture appears to contain explicit content and cannot be used as a store profile picture.'),
            'uncertain' => throw new ApiError(422, 'avatar_uncertain_content', 'We could not confirm that this picture meets the profile-photo rules. Choose another picture.'),
            default => throw $this->screeningUnavailable(),
        };
    }

    private function post(string $path, string $bytes): Response
    {
        return Http::withHeaders(['X-Photo-Service-Token' => (string) config('marketplace.photo_service.token')])
            ->connectTimeout(3)
            ->timeout(90)
            ->withBody($bytes, 'application/octet-stream')
            ->post(rtrim((string) config('marketplace.photo_service.url'), '/').$path);
    }

    private function processingUnavailable(): ApiError
    {
        return new ApiError(503, 'photo_processing_unavailable', 'Photo processing is temporarily unavailable. Please try again shortly.');
    }

    private function screeningUnavailable(string $message = 'Photo safety screening is temporarily unavailable. Your current picture is unchanged; please try again later.'): ApiError
    {
        return new ApiError(503, 'avatar_screening_unavailable', $message);
    }
}
