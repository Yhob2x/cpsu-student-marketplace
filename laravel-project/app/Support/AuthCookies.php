<?php

namespace App\Support;

use App\Services\AccessTokens;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

class AuthCookies
{
    public const REFRESH = 'refresh';

    public const MEDIA = 'media';

    private const REFRESH_PATH = '/api/v1/auth';

    private const MEDIA_PATH = '/api/v1/media';

    public static function attach(Response $response, string $refreshToken, string $accessToken, int $refreshDays): void
    {
        $secure = (bool) config('marketplace.cookie_secure');
        $response->headers->setCookie(Cookie::create(self::REFRESH, $refreshToken, time() + $refreshDays * 86400, self::REFRESH_PATH, null, $secure, true, true, Cookie::SAMESITE_LAX));
        $response->headers->setCookie(Cookie::create(self::MEDIA, $accessToken, time() + AccessTokens::TTL_SECONDS, self::MEDIA_PATH, null, $secure, true, true, Cookie::SAMESITE_LAX));
    }

    public static function clear(Response $response): void
    {
        $response->headers->clearCookie(self::REFRESH, self::REFRESH_PATH, null, false, false);
        $response->headers->clearCookie(self::MEDIA, self::MEDIA_PATH, null, false, false);
    }
}
