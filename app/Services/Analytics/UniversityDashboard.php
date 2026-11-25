<?php

namespace App\Services\Analytics;

use App\Models\Listing;
use App\Support\AnalyticsRange;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

final class UniversityDashboard
{
    private const PREVIOUS_PERIOD_LABELS = [
        '7d' => 'previous 7 days',
        '30d' => 'previous 30 days',
        '90d' => 'previous 90 days',
        '12m' => 'previous 12 months',
    ];

    private const ACTIVE_STATUSES = [
        'awaitingSeller' => 'pending',
        'accepted' => 'accepted',
        'arrangingMeetup' => 'negotiating',
        'meetupAgreed' => 'for_meetup',
    ];

    public function build(AnalyticsRange $range): array
    {
        return DB::transaction(fn () => $this->snapshot($range));
    }

    private function snapshot(AnalyticsRange $range): array
    {
        $previous = $range->previous();
        $categories = $this->categories();
        $live = array_sum(array_column($categories, 'liveListings'));

        $ordersByCampus = $this->countsBy(
            $this->ordersCreated($range)->join('Listing as li', 'li.id', '=', 't.listingId'),
            'li.campusId',
        );
        $completed = $this->completions($range)
            ->selectRaw('COUNT(*) AS total, COALESCE(SUM(t.price), 0) AS sales, AVG(TIMESTAMPDIFF(SECOND, t.createdAt, status_event.occurredAt)) AS seconds')
            ->first();
        $completedCount = (int) $completed->total;
        $current = [
            'newOrders' => array_sum($ordersByCampus),
            'completedOrders' => $completedCount,
        ] + $this->activity($range);
        $prior = [
            'newOrders' => $this->ordersCreated($previous)->count(),
            'completedOrders' => $this->completions($previous)->count(),
        ] + $this->activity($previous);
        $changes = [];
        foreach ($current as $key => $count) {
            $changes[$key] = DashboardPrivacy::safeChange($count, $prior[$key]);
        }
        $kpis = array_map(DashboardPrivacy::maskCount(...), ['liveListings' => $live] + $current);
        $campuses = $this->campuses($range, $ordersByCampus);

        return [
            'period' => $range->key,
            'previousPeriodLabel' => self::PREVIOUS_PERIOD_LABELS[$range->key],
            'generatedAt' => ApiResponse::date($range->end),
            'reviewQueue' => $this->reviewQueue(),
            'kpis' => $kpis + ['changes' => $changes],
            'funnel' => [
                'liveListings' => $kpis['liveListings'],
                'inquiries' => $kpis['inquiries'],
                'orders' => $kpis['newOrders'],
                'completed' => $kpis['completedOrders'],
            ],
            'ordersInProgress' => $this->ordersInProgress(),
            'series' => $this->series($range),
            'quality' => $this->quality($range, $completedCount, (float) $completed->sales, (float) $completed->seconds),
            'categories' => array_map(fn (array $category) => [
                'name' => $category['name'],
                'liveListings' => DashboardPrivacy::maskCount($category['liveListings']),
            ], $categories),
            'campuses' => $campuses['active'],
            'inactiveCampusCount' => DashboardPrivacy::maskCount($campuses['inactiveCount']),
        ];
    }

    private function activity(AnalyticsRange $range): array
    {
        return [
            'inquiries' => $this->within(DB::table('InquiryThread'), 'createdAt', $range)->count(),
            'listingsApproved' => $this->within(DB::table('ListingReview')->where('decision', 'approved'), 'createdAt', $range)
                ->distinct()->count('listingId'),
            'studentsVerified' => $this->within(DB::table('Affiliation')->where('verificationStatus', 'verified'), 'verifiedAt', $range)
                ->distinct()->count('userId'),
        ];
    }

    private function reviewQueue(): array
    {
        return [
            'listings' => DashboardPrivacy::maskCount(DB::table('Listing')->where('status', 'pending_review')->whereNull('deletedAt')->count()),
            'verifications' => DashboardPrivacy::maskCount(DB::table('Affiliation')->where('verificationStatus', 'pending')->count()),
        ];
    }

    private function ordersInProgress(): array
    {
        $counts = $this->countsBy(DB::table('Transaction')->whereIn('status', array_values(self::ACTIVE_STATUSES)), 'status');

        return array_map(fn (string $status) => DashboardPrivacy::maskCount($counts[$status] ?? 0), self::ACTIVE_STATUSES);
    }

    private function series(AnalyticsRange $range): array
    {
        $day = AnalyticsRange::localDay('status_event.occurredAt');
        $counts = $this->completions($range)->selectRaw("{$day} AS day, COUNT(*) AS total")
            ->groupBy('day')->pluck('total', 'day')->map(fn ($count) => (int) $count)->all();

        return [
            'granularity' => $range->bucket,
            'points' => array_map(fn (array $point) => [
                'label' => $point['label'],
                'completed' => DashboardPrivacy::maskCount($point['completed']),
            ], TrendBuckets::fill($range, ['completed' => $counts])),
        ];
    }

    private function quality(AnalyticsRange $range, int $completed, float $sales, float $seconds): ?array
    {
        if ($completed < DashboardPrivacy::MIN_GROUP) {
            return null;
        }
        $cancelled = $this->terminalOrders($range, 'cancelled')->count();

        return [
            'reportedSales' => DashboardPrivacy::maskPeso($sales, $completed),
            // An exact rate alongside the completed count would expose a small cancellation count.
            'cancellationRatePct' => DashboardPrivacy::maskCount($cancelled) === '<5'
                ? null : round(100 * $cancelled / ($completed + $cancelled), 1),
            'avgDaysToComplete' => round($seconds / 86400, 1),
        ];
    }

    private function categories(): array
    {
        $counts = $this->countsBy($this->liveListings(), 'categoryId');

        return DB::table('Category')->whereIn('id', array_keys($counts))->get(['id', 'name'])
            ->sortBy([fn ($a, $b) => $this->countRank($counts[$b->id]) <=> $this->countRank($counts[$a->id]), ['name', 'asc'], ['id', 'asc']])
            ->map(fn ($category) => ['name' => $category->name, 'liveListings' => $counts[$category->id]])
            ->values()->all();
    }

    /** @param array<int, int> $ordersByCampus */
    private function campuses(AnalyticsRange $range, array $ordersByCampus): array
    {
        $campuses = DB::table('Campus')->where('active', true)->get(['id', 'name']);
        $storefronts = $this->countsBy(DB::table('SellerProfile')->whereIn('id', ListingAccess::visibleStoreIds()), 'campusId');
        $live = $this->countsBy($this->liveListings(), 'campusId');
        $completed = $this->completions($range)->join('Listing as li', 'li.id', '=', 't.listingId')
            ->selectRaw('li.campusId, COUNT(*) AS total, SUM(t.price) AS sales')->groupBy('li.campusId')->get()->keyBy('campusId');

        $active = $campuses->filter(fn ($campus) => isset($storefronts[$campus->id]) || isset($live[$campus->id])
            || isset($ordersByCampus[$campus->id]) || isset($completed[$campus->id]))
            ->sortBy([fn ($a, $b) => $this->countRank($live[$b->id] ?? 0) <=> $this->countRank($live[$a->id] ?? 0), ['name', 'asc'], ['id', 'asc']])
            ->map(function ($campus) use ($storefronts, $live, $ordersByCampus, $completed) {
                $count = (int) ($completed[$campus->id]->total ?? 0);

                return [
                    'name' => $campus->name,
                    'storefronts' => DashboardPrivacy::maskCount($storefronts[$campus->id] ?? 0),
                    'liveListings' => DashboardPrivacy::maskCount($live[$campus->id] ?? 0),
                    'newOrders' => DashboardPrivacy::maskCount($ordersByCampus[$campus->id] ?? 0),
                    'completed' => DashboardPrivacy::maskCount($count),
                    'reportedSales' => DashboardPrivacy::maskPeso((float) ($completed[$campus->id]->sales ?? 0), $count),
                ];
            })->values();

        return ['active' => $active->all(), 'inactiveCount' => $campuses->count() - $active->count()];
    }

    private function liveListings(): Builder
    {
        return ListingAccess::availablePublicListing(Listing::query())->toBase();
    }

    private function countRank(int $count): int
    {
        // Suppressed counts sort together so the row order reveals no ranking within the band.
        return DashboardPrivacy::maskCount($count) === '<5' ? 1 : $count;
    }

    private function ordersCreated(AnalyticsRange $range): Builder
    {
        return $this->within(DB::table('Transaction as t'), 't.createdAt', $range);
    }

    private function completions(AnalyticsRange $range): Builder
    {
        return $this->terminalOrders($range, 'completed')
            ->whereNotNull('t.buyerCompletionConfirmedAt')->whereNotNull('t.sellerCompletionConfirmedAt');
    }

    private function terminalOrders(AnalyticsRange $range, string $status): Builder
    {
        [$from] = $range->utcBounds();
        // Group duplicate events within the period and exclude repeats of events already counted in earlier periods.
        $events = $this->within(DB::table('TransactionStatusLog as log')->where('log.toStatus', $status), 'log.createdAt', $range)
            ->whereNotExists(fn (Builder $earlier) => $earlier->selectRaw('1')->from('TransactionStatusLog as earlier')
                ->whereColumn('earlier.transactionId', 'log.transactionId')
                ->whereColumn('earlier.toStatus', 'log.toStatus')
                ->where('earlier.createdAt', '<', $from))
            ->selectRaw('log.transactionId, MIN(log.createdAt) AS occurredAt')->groupBy('log.transactionId');

        return DB::table('Transaction as t')->joinSub($events, 'status_event', 'status_event.transactionId', '=', 't.id')->where('t.status', $status);
    }

    private function within(Builder $query, string $column, AnalyticsRange $range): Builder
    {
        [$from, $to] = $range->utcBounds();

        return $query->where($column, '>=', $from)->where($column, '<', $to);
    }

    private function countsBy(Builder $query, string $column): array
    {
        return $query->select($column.' as groupKey')->selectRaw('COUNT(*) AS total')
            ->groupBy($column)->pluck('total', 'groupKey')->map(fn ($count) => (int) $count)->all();
    }
}
