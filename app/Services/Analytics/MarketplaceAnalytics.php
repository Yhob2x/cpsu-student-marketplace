<?php

namespace App\Services\Analytics;

use App\Support\AnalyticsRange;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Campus-scoped marketplace analytics for reviewers and university admins.
 *
 * Student activity counts from 1 to 4 are reported as "<5" so small groups of
 * students cannot be identified, and peso totals are shown only when at least
 * five completed orders stand behind them. Staff workload counts are exact.
 */
final class MarketplaceAnalytics
{
    public const MIN_GROUP = 5;

    /** @param  list<int>|'all'  $campusIds */
    public function build(array|string $campusIds, AnalyticsRange $range): array
    {
        return [
            'range' => $range->toArray(),
            'note' => 'Sales are the agreed prices of orders that both students confirmed as completed. Payments happen between students and are not processed by the marketplace.',
            'privacyNote' => 'Counts from 1 to 4 show as <5, and peso totals appear only when at least 5 completed orders are included.',
            'summary' => [
                'current' => $this->summary($campusIds, $range),
                'previous' => $this->summary($campusIds, $range->previous()),
            ],
            'trend' => $this->trend($campusIds, $range),
            'pipeline' => $this->pipeline($campusIds),
            'workload' => $this->workload($campusIds),
            'categories' => $this->categories($campusIds, $range),
            'campuses' => $this->campuses($campusIds, $range),
        ];
    }

    private function summary(array|string $campusIds, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $completed = $this->scoped($this->completions($from, $to), $campusIds)
            ->selectRaw('COUNT(*) AS orders, COALESCE(SUM(t.price), 0) AS sales, AVG(TIMESTAMPDIFF(SECOND, t.createdAt, l.createdAt)) AS seconds')->first();
        $cancelled = $this->scoped($this->cancellations($from, $to), $campusIds)->count();
        $orders = (int) $completed->orders;
        $enough = $orders >= self::MIN_GROUP;

        return [
            'ordersCreated' => self::suppress($this->scoped($this->orders()->where('t.createdAt', '>=', $from)->where('t.createdAt', '<', $to), $campusIds)->count()),
            'completedOrders' => self::suppress($orders),
            'cancelledOrders' => self::suppress($cancelled),
            'cancellationRate' => $orders + $cancelled >= self::MIN_GROUP ? round($cancelled / ($orders + $cancelled), 3) : null,
            'reportedSales' => $enough ? round((float) $completed->sales, 2) : null,
            'averageOrderValue' => $enough ? round(((float) $completed->sales) / $orders, 2) : null,
            'averageHoursToComplete' => $enough && $completed->seconds !== null ? round(((float) $completed->seconds) / 3600, 1) : null,
            'listingsApproved' => self::suppress($this->approvals($campusIds, $from, $to)->distinct()->count('r.listingId')),
            'studentsVerified' => self::suppress($this->campusFilter(DB::table('Affiliation as a'), 'a.campusId', $campusIds)
                ->where('a.verificationStatus', 'verified')->where('a.verifiedAt', '>=', $from)->where('a.verifiedAt', '<', $to)->count()),
            'inquiries' => self::suppress($this->campusFilter(DB::table('InquiryThread as i')->join('Listing as li', 'li.id', '=', 'i.listingId'), 'li.campusId', $campusIds)
                ->where('i.createdAt', '>=', $from)->where('i.createdAt', '<', $to)->count()),
        ];
    }

    private function trend(array|string $campusIds, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $series = ['ordersCreated' => [], 'ordersCompleted' => [], 'listingsApproved' => []];
        $created = AnalyticsRange::localDay('t.createdAt');
        foreach ($this->scoped($this->orders()->where('t.createdAt', '>=', $from)->where('t.createdAt', '<', $to), $campusIds)
            ->selectRaw("{$created} AS day, COUNT(*) AS n")->groupBy('day')->get() as $row) {
            $series['ordersCreated'][$row->day] = (int) $row->n;
        }
        $completedDay = AnalyticsRange::localDay('l.createdAt');
        foreach ($this->scoped($this->completions($from, $to), $campusIds)->selectRaw("{$completedDay} AS day, COUNT(*) AS n")->groupBy('day')->get() as $row) {
            $series['ordersCompleted'][$row->day] = (int) $row->n;
        }
        $approvedDay = AnalyticsRange::localDay('r.createdAt');
        foreach ($this->approvals($campusIds, $from, $to)->selectRaw("{$approvedDay} AS day, COUNT(DISTINCT r.listingId) AS n")->groupBy('day')->get() as $row) {
            $series['listingsApproved'][$row->day] = (int) $row->n;
        }

        return array_map(function (array $bucket) {
            foreach (['ordersCreated', 'ordersCompleted', 'listingsApproved'] as $name) {
                $bucket[$name] = self::suppress($bucket[$name]);
            }

            return $bucket;
        }, TrendBuckets::fill($range, $series));
    }

    private function pipeline(array|string $campusIds): array
    {
        $counts = $this->scoped($this->orders()->whereIn('t.status', SellerAnalytics::ACTIVE_STATUSES), $campusIds)
            ->selectRaw('t.status AS status, COUNT(*) AS n')->groupBy('t.status')->pluck('n', 'status');

        return array_combine(SellerAnalytics::ACTIVE_STATUSES, array_map(fn (string $status) => self::suppress((int) ($counts[$status] ?? 0)), SellerAnalytics::ACTIVE_STATUSES));
    }

    /** Exact counts of work waiting for staff in the permitted campuses. */
    private function workload(array|string $campusIds): array
    {
        $pending = $this->campusFilter(DB::table('Listing as li'), 'li.campusId', $campusIds)->where('li.status', 'pending_review')->whereNull('li.deletedAt');
        $oldest = (clone $pending)->min('li.updatedAt');

        return [
            'pendingListings' => (clone $pending)->count(),
            'oldestPendingListingHours' => $oldest === null ? null : (int) floor((time() - strtotime($oldest.' UTC')) / 3600),
            'pendingAffiliations' => $this->campusFilter(DB::table('Affiliation as a'), 'a.campusId', $campusIds)->where('a.verificationStatus', 'pending')->count(),
            'openReports' => $this->reports($campusIds)->count(),
            'pendingStoreReviews' => $this->campusFilter(DB::table('StoreReview as sr')->join('SellerProfile as sp', 'sp.id', '=', 'sr.sellerProfileId'), 'sp.campusId', $campusIds)
                ->where('sr.status', 'pending')->count(),
        ];
    }

    /** Busiest categories by completed orders in the window, then by live listings. */
    private function categories(array|string $campusIds, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $completed = $this->scoped($this->completions($from, $to), $campusIds)
            ->selectRaw('li.categoryId AS categoryId, COUNT(*) AS n, SUM(t.price) AS sales')->groupBy('li.categoryId')->get()->keyBy('categoryId');
        $live = $this->campusFilter(DB::table('Listing as li'), 'li.campusId', $campusIds)->where('li.status', 'published')->whereNull('li.deletedAt')
            ->selectRaw('li.categoryId AS categoryId, COUNT(*) AS n')->groupBy('li.categoryId')->pluck('n', 'categoryId');
        $rows = DB::table('Category')->orderBy('id')->get(['id', 'name'])->map(function ($category) use ($completed, $live) {
            $done = $completed[$category->id] ?? null;
            $orders = $done ? (int) $done->n : 0;

            return [
                'id' => (int) $category->id,
                'name' => $category->name,
                'completedOrders' => $orders,
                'publishedListings' => (int) ($live[$category->id] ?? 0),
                'reportedSales' => $orders >= self::MIN_GROUP ? round((float) $done->sales, 2) : null,
            ];
        })->filter(fn (array $row) => $row['completedOrders'] > 0 || $row['publishedListings'] > 0)->values()->all();
        usort($rows, fn (array $a, array $b) => [$b['completedOrders'], $b['publishedListings'], $a['id']] <=> [$a['completedOrders'], $a['publishedListings'], $b['id']]);

        return array_map(fn (array $row) => ['completedOrders' => self::suppress($row['completedOrders']), 'publishedListings' => self::suppress($row['publishedListings'])] + $row,
            array_slice($rows, 0, 8));
    }

    private function campuses(array|string $campusIds, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $campuses = $this->campusFilter(DB::table('Campus'), 'id', $campusIds)->where('active', true)->orderBy('id')->get(['id', 'code', 'name']);
        $completed = $this->completions($from, $to)
            ->selectRaw('li.campusId AS campusId, COUNT(*) AS n, SUM(t.price) AS sales')->groupBy('li.campusId')->get()->keyBy('campusId');
        $created = $this->orders()->where('t.createdAt', '>=', $from)->where('t.createdAt', '<', $to)
            ->selectRaw('li.campusId AS campusId, COUNT(*) AS n')->groupBy('li.campusId')->pluck('n', 'campusId');
        $live = DB::table('Listing')->where('status', 'published')->whereNull('deletedAt')->selectRaw('campusId, COUNT(*) AS n')->groupBy('campusId')->pluck('n', 'campusId');
        $stores = DB::table('SellerProfile as sp')->join('User as u', 'u.id', '=', 'sp.ownerUserId')->where('sp.approvalStatus', 'approved')->where('u.status', 'active')
            ->selectRaw('sp.campusId AS campusId, COUNT(*) AS n')->groupBy('sp.campusId')->pluck('n', 'campusId');

        return $campuses->map(function ($campus) use ($completed, $created, $live, $stores) {
            $done = $completed[$campus->id] ?? null;
            $orders = $done ? (int) $done->n : 0;

            return [
                'campus' => $campus->code,
                'name' => $campus->name,
                'activeStorefronts' => self::suppress((int) ($stores[$campus->id] ?? 0)),
                'publishedListings' => self::suppress((int) ($live[$campus->id] ?? 0)),
                'ordersCreated' => self::suppress((int) ($created[$campus->id] ?? 0)),
                'completedOrders' => self::suppress($orders),
                'reportedSales' => $orders >= self::MIN_GROUP ? round((float) $done->sales, 2) : null,
            ];
        })->all();
    }

    public static function suppress(int $value): int|string
    {
        return $value > 0 && $value < self::MIN_GROUP ? '<5' : $value;
    }

    /** Orders joined to their listing. Alias t = order, li = listing. */
    private function orders(): Builder
    {
        return DB::table('Transaction as t')->join('Listing as li', 'li.id', '=', 't.listingId');
    }

    private function completions(string $from, string $to): Builder
    {
        return $this->orders()->join('TransactionStatusLog as l', 'l.transactionId', '=', 't.id')
            ->where('l.toStatus', 'completed')->where('t.status', 'completed')->where('l.createdAt', '>=', $from)->where('l.createdAt', '<', $to);
    }

    private function cancellations(string $from, string $to): Builder
    {
        return $this->orders()->join('TransactionStatusLog as l', 'l.transactionId', '=', 't.id')
            ->where('l.toStatus', 'cancelled')->where('l.createdAt', '>=', $from)->where('l.createdAt', '<', $to);
    }

    /** First approvals of listings in the window. */
    private function approvals(array|string $campusIds, string $from, string $to): Builder
    {
        return $this->campusFilter(DB::table('ListingReview as r')->join('Listing as rl', 'rl.id', '=', 'r.listingId'), 'rl.campusId', $campusIds)
            ->where('r.decision', 'approved')->where('r.createdAt', '>=', $from)->where('r.createdAt', '<', $to);
    }

    /** Open reports whose every target lies in a permitted campus, as in the review workspace. */
    private function reports(array|string $campusIds): Builder
    {
        $query = DB::table('Report as rp')->whereIn('rp.status', ['open', 'reviewing']);
        if ($campusIds === 'all') {
            return $query;
        }

        return $query->where(fn (Builder $target) => $target->whereNotNull('rp.listingId')->orWhereNotNull('rp.sellerProfileId'))
            ->where(fn (Builder $q) => $q->whereNull('rp.listingId')->orWhereExists(fn (Builder $sub) => $sub->from('Listing')->whereColumn('Listing.id', 'rp.listingId')->whereIn('Listing.campusId', $campusIds)))
            ->where(fn (Builder $q) => $q->whereNull('rp.sellerProfileId')->orWhereExists(fn (Builder $sub) => $sub->from('SellerProfile')->whereColumn('SellerProfile.id', 'rp.sellerProfileId')->whereIn('SellerProfile.campusId', $campusIds)));
    }

    private function scoped(Builder $query, array|string $campusIds): Builder
    {
        return $this->campusFilter($query, 'li.campusId', $campusIds);
    }

    private function campusFilter(Builder $query, string $column, array|string $campusIds): Builder
    {
        return $campusIds === 'all' ? $query : $query->whereIn($column, $campusIds);
    }
}
