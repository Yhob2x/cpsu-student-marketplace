<?php

namespace App\Services\Analytics;

final class DashboardPrivacy
{
    public const MIN_GROUP = 5;

    public static function maskCount(int $count): int|string
    {
        return $count > 0 && $count < self::MIN_GROUP ? '<5' : $count;
    }

    public static function maskPeso(float $amount, int $completed): ?float
    {
        return $completed >= self::MIN_GROUP ? round($amount, 2) : null;
    }

    public static function safeChange(int $current, ?int $previous): ?float
    {
        if ($current < self::MIN_GROUP || $previous === null || $previous < self::MIN_GROUP) {
            return null;
        }

        return round(100 * ($current - $previous) / $previous, 1);
    }
}
