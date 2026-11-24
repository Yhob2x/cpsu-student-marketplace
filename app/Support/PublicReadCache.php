<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/** Short cache for unfiltered public reference data. Admin writes clear the affected entry. */
final class PublicReadCache
{
    public const CAMPUSES = 'public-read:campuses';

    public const CATEGORIES = 'public-read:categories';

    public const GUIDELINES = 'public-read:guidelines';

    public const ANNOUNCEMENTS = 'public-read:announcements';

    private const TTL_SECONDS = 30;

    public static function read(string $key, callable $load): mixed
    {
        return Cache::remember($key, self::TTL_SECONDS, $load);
    }

    public static function forget(string $key): void
    {
        Cache::forget($key);
    }
}
