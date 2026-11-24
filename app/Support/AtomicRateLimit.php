<?php

namespace App\Support;

use Illuminate\Support\Facades\RateLimiter;
use RuntimeException;

/**
 * Serializes limiter updates across PHP workers on this host, because the file cache's
 * increment is not atomic. A fixed set of lock files keeps disk use bounded.
 * A deployment with several servers needs a shared atomic cache instead.
 */
final class AtomicRateLimit
{
    private const LOCK_STRIPES = 64;

    public static function hit(string $key, int $decaySeconds): int
    {
        return self::locked($key, fn () => RateLimiter::hit($key, $decaySeconds));
    }

    public static function decrement(string $key, int $decaySeconds): int
    {
        return self::locked($key, fn () => RateLimiter::decrement($key, $decaySeconds));
    }

    private static function locked(string $key, callable $work): int
    {
        $directory = storage_path('framework/cache/rate-locks');
        if (! is_dir($directory)) {
            @mkdir($directory, 0700, true);
        }

        $stripe = crc32($key) % self::LOCK_STRIPES;
        $handle = fopen($directory.DIRECTORY_SEPARATOR."{$stripe}.lock", 'c');
        if ($handle === false || ! flock($handle, LOCK_EX)) {
            throw new RuntimeException('Rate limit lock is unavailable.');
        }

        try {
            return $work();
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
