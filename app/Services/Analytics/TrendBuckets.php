<?php

namespace App\Services\Analytics;

use App\Support\AnalyticsRange;

/** Rolls per-day series into the range's chart buckets, filling gaps with zero. */
final class TrendBuckets
{
    /**
     * @param  array<string, array<string, int|float>>  $series  series name => [local day (Y-m-d) => value]
     * @param  list<string>  $money  series rounded to centavos
     * @return list<array<string, mixed>>
     */
    public static function fill(AnalyticsRange $range, array $series, array $money = []): array
    {
        $buckets = [];
        foreach ($range->buckets() as $key => $label) {
            $buckets[$key] = ['key' => $key, 'label' => $label] + array_fill_keys(array_keys($series), 0);
        }
        foreach ($series as $name => $days) {
            foreach ($days as $day => $value) {
                $key = $range->bucketKey((string) $day);
                if (isset($buckets[$key])) {
                    $buckets[$key][$name] += $value;
                }
            }
        }
        foreach ($buckets as &$bucket) {
            foreach ($money as $name) {
                $bucket[$name] = round((float) $bucket[$name], 2);
            }
        }

        return array_values($buckets);
    }
}
