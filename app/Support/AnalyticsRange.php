<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * A reporting window in campus local time, split into chart buckets.
 *
 * The database stores UTC. Every range starts at local midnight in Asia/Manila
 * (UTC+8, no daylight saving) so a "day" matches what students experience.
 */
final class AnalyticsRange
{
    public const TIMEZONE = 'Asia/Manila';

    public const UTC_OFFSET_HOURS = 8;

    /** Range key => [bucket size, number of buckets]. */
    public const RANGES = [
        '7d' => ['day', 7],
        '30d' => ['day', 30],
        '90d' => ['week', 13],
        '12m' => ['month', 12],
    ];

    private function __construct(
        public readonly string $key,
        public readonly string $bucket,
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
    ) {}

    public static function fromQuery(array $query, ?CarbonImmutable $now = null): self
    {
        $key = ApiQuery::enum($query, 'range', array_keys(self::RANGES), '30d');

        return self::make($key, $now ?? CarbonImmutable::now(self::TIMEZONE));
    }

    public static function make(string $key, CarbonImmutable $now): self
    {
        [$bucket, $count] = self::RANGES[$key];
        $local = $now->setTimezone(self::TIMEZONE);
        $start = match ($bucket) {
            'day' => $local->startOfDay()->subDays($count - 1),
            'week' => $local->startOfWeek(CarbonImmutable::MONDAY)->subWeeks($count - 1),
            'month' => $local->startOfMonth()->subMonths($count - 1),
        };

        return new self($key, $bucket, $start, $local);
    }

    /** The window of the same length that ends where this one starts. */
    public function previous(): self
    {
        [, $count] = self::RANGES[$this->key];
        $start = match ($this->bucket) {
            'day' => $this->start->subDays($count),
            'week' => $this->start->subWeeks($count),
            'month' => $this->start->subMonths($count),
        };

        return new self($this->key, $this->bucket, $start, $this->start);
    }

    /** UTC bounds for SQL: [inclusive start, exclusive end]. */
    public function utcBounds(): array
    {
        return [$this->start->utc()->format('Y-m-d H:i:s.v'), $this->end->utc()->format('Y-m-d H:i:s.v')];
    }

    /** First and last campus-local calendar day inside the window, for DATE columns. */
    public function localDays(): array
    {
        return [$this->start->format('Y-m-d'), $this->end->subMicrosecond()->format('Y-m-d')];
    }

    /** SQL expression for the campus-local calendar day of a UTC column. */
    public static function localDay(string $column): string
    {
        return 'DATE(DATE_ADD('.$column.', INTERVAL '.self::UTC_OFFSET_HOURS.' HOUR))';
    }

    /** Bucket key for a campus-local calendar day (Y-m-d). */
    public function bucketKey(string $day): string
    {
        $date = CarbonImmutable::createFromFormat('Y-m-d', $day, self::TIMEZONE)->startOfDay();

        return match ($this->bucket) {
            'day' => $date->format('Y-m-d'),
            'week' => $date->startOfWeek(CarbonImmutable::MONDAY)->format('Y-m-d'),
            'month' => $date->format('Y-m'),
        };
    }

    /** Ordered, empty chart buckets: key => label. */
    public function buckets(): array
    {
        [, $count] = self::RANGES[$this->key];
        $out = [];
        for ($i = 0; $i < $count; $i++) {
            $at = match ($this->bucket) {
                'day' => $this->start->addDays($i),
                'week' => $this->start->addWeeks($i),
                'month' => $this->start->addMonths($i),
            };
            $out[$this->bucket === 'month' ? $at->format('Y-m') : $at->format('Y-m-d')] = match ($this->bucket) {
                'day' => $at->format('M j'),
                'week' => 'Week of '.$at->format('M j'),
                'month' => $at->format('M Y'),
            };
        }

        return $out;
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'bucket' => $this->bucket,
            'timezone' => self::TIMEZONE,
            'start' => $this->start->format('Y-m-d'),
            'end' => $this->end->format('Y-m-d'),
        ];
    }
}
