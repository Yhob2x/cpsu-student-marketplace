<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use RuntimeException;
use Throwable;

/** HS256 access tokens compatible with those issued by the Express API. */
class AccessTokens
{
    public const TTL_SECONDS = 900;

    public function sign(int $userId): string
    {
        $issuedAt = time();

        return JWT::encode(['sub' => (string) $userId, 'iat' => $issuedAt, 'exp' => $issuedAt + self::TTL_SECONDS], $this->secret(), 'HS256');
    }

    /** Returns the user id, or null for any invalid, expired or malformed token. */
    public function userId(string $token): ?int
    {
        try {
            $claims = JWT::decode($token, new Key($this->secret(), 'HS256'));
        } catch (Throwable) {
            return null;
        }

        $subject = $claims->sub ?? null;

        return is_string($subject) && ctype_digit($subject) && strlen($subject) <= 10 ? (int) $subject : null;
    }

    private function secret(): string
    {
        $secret = (string) config('marketplace.jwt_secret');
        if (strlen($secret) < 32) {
            throw new RuntimeException('JWT_SECRET must be at least 32 characters.');
        }

        return $secret;
    }
}
