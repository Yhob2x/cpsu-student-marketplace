<?php

namespace App\Services\Analytics;

use App\Support\AnalyticsRange;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Order tracking and performance figures for one student's store.
 *
 * "Reported sales" add up the agreed price of orders that both students
 * confirmed as completed. The marketplace never processes the payment.
 */
final class SellerAnalytics
{
    public const ACTIVE_STATUSES = ['pending', 'accepted', 'negotiating', 'for_meetup'];

    private const LOW_STOCK_THRESHOLD = 1;

    public function build(int $sellerUserId, int $storeId, AnalyticsRange $range): array
    {
        $listings = $this->listings($sellerUserId, $storeId, $range);

        return [
            'range' => $range->toArray(),
            'note' => 'Sales are the agreed prices of orders that both students confirmed as completed. Payments happen between students and are not processed by the marketplace.',
            'summary' => [
                'current' => $this->summary($sellerUserId, $storeId, $range),
                'previous' => $this->summary($sellerUserId, $storeId, $range->previous()),
            ],
            'trend' => $this->trend($sellerUserId, $storeId, $range),
            'pipeline' => $this->pipeline($sellerUserId),
            'needsAction' => $this->needsAction($sellerUserId),
            'waitingOnBuyer' => $this->waitingOnBuyer($sellerUserId),
            'listings' => $listings,
            'lowStock' => array_values(array_filter($listings, fn (array $listing) => $listing['lowStock'])),
            'rating' => $this->rating($storeId),
            'viewsTrackedSince' => $this->viewsTrackedSince($storeId),
        ];
    }

    /** Headline figures for one window. */
    public function summary(int $sellerUserId, int $storeId, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $completed = $this->completions($from, $to)->where('t.sellerUserId', $sellerUserId)
            ->selectRaw('COUNT(*) AS orders, COALESCE(SUM(t.price), 0) AS sales, AVG(TIMESTAMPDIFF(SECOND, t.createdAt, l.createdAt)) AS seconds')
            ->first();
        $cancelled = $this->cancellations($from, $to)->where('t.sellerUserId', $sellerUserId)->count();
        $orders = (int) $completed->orders;
        $sales = round((float) $completed->sales, 2);

        return [
            'reportedSales' => $sales,
            'completedOrders' => $orders,
            'averageOrderValue' => $orders > 0 ? round($sales / $orders, 2) : null,
            'averageHoursToComplete' => $completed->seconds !== null ? round(((float) $completed->seconds) / 3600, 1) : null,
            'ordersCreated' => DB::table('Transaction')->where('sellerUserId', $sellerUserId)->where('createdAt', '>=', $from)->where('createdAt', '<', $to)->count(),
            'cancelledOrders' => $cancelled,
            'cancellationRate' => $orders + $cancelled > 0 ? round($cancelled / ($orders + $cancelled), 3) : null,
            'inquiries' => DB::table('InquiryThread')->where('sellerProfileId', $storeId)->where('createdAt', '>=', $from)->where('createdAt', '<', $to)->count(),
            'views' => (int) $this->views($storeId, $range)->sum('d.viewCount'),
        ];
    }

    private function trend(int $sellerUserId, int $storeId, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $series = ['ordersCreated' => [], 'ordersCompleted' => [], 'reportedSales' => [], 'inquiries' => [], 'views' => []];
        $day = AnalyticsRange::localDay('createdAt');
        foreach (DB::table('Transaction')->where('sellerUserId', $sellerUserId)->where('createdAt', '>=', $from)->where('createdAt', '<', $to)
            ->selectRaw("{$day} AS day, COUNT(*) AS n")->groupBy('day')->get() as $row) {
            $series['ordersCreated'][$row->day] = (int) $row->n;
        }
        $completionDay = AnalyticsRange::localDay('l.createdAt');
        foreach ($this->completions($from, $to)->where('t.sellerUserId', $sellerUserId)
            ->selectRaw("{$completionDay} AS day, COUNT(*) AS n, SUM(t.price) AS sales")->groupBy('day')->get() as $row) {
            $series['ordersCompleted'][$row->day] = (int) $row->n;
            $series['reportedSales'][$row->day] = (float) $row->sales;
        }
        foreach (DB::table('InquiryThread')->where('sellerProfileId', $storeId)->where('createdAt', '>=', $from)->where('createdAt', '<', $to)
            ->selectRaw("{$day} AS day, COUNT(*) AS n")->groupBy('day')->get() as $row) {
            $series['inquiries'][$row->day] = (int) $row->n;
        }
        foreach ($this->views($storeId, $range)->selectRaw('d.day AS day, SUM(d.viewCount) AS n')->groupBy('d.day')->get() as $row) {
            $series['views'][(string) $row->day] = (int) $row->n;
        }

        return TrendBuckets::fill($range, $series, money: ['reportedSales']);
    }

    /** Orders in progress right now, by status. */
    private function pipeline(int $sellerUserId): array
    {
        $counts = DB::table('Transaction')->where('sellerUserId', $sellerUserId)->whereIn('status', self::ACTIVE_STATUSES)
            ->selectRaw('status, COUNT(*) AS n')->groupBy('status')->pluck('n', 'status');

        return array_combine(self::ACTIVE_STATUSES, array_map(fn (string $status) => (int) ($counts[$status] ?? 0), self::ACTIVE_STATUSES));
    }

    /** Orders that cannot move forward until the seller acts, oldest first. */
    private function needsAction(int $sellerUserId): array
    {
        $rows = $this->sellerTurn(DB::table('Transaction as t')->where('t.sellerUserId', $sellerUserId))
            ->join('Listing as li', 'li.id', '=', 't.listingId')
            ->join('User as b', 'b.id', '=', 't.buyerUserId')
            ->orderBy('t.createdAt')->orderBy('t.id')->limit(20)
            ->get(['t.id', 't.listingId', 'li.title', 'b.displayName', 't.status', 't.price', 't.createdAt', 't.updatedAt', 't.sellerMeetupConfirmedAt', 't.sellerCompletionConfirmedAt']);

        return $rows->map(fn ($row) => [
            'id' => (int) $row->id,
            'listingId' => (int) $row->listingId,
            'listingTitle' => $row->title,
            'buyerName' => $row->displayName,
            'status' => $row->status,
            'price' => round((float) $row->price, 2),
            'action' => match (true) {
                $row->status === 'pending' => 'decide',
                $row->status === 'for_meetup' => 'confirm_completion',
                default => 'confirm_meetup',
            },
            'createdAt' => self::iso($row->createdAt),
            'updatedAt' => self::iso($row->updatedAt),
        ])->all();
    }

    private function waitingOnBuyer(int $sellerUserId): int
    {
        return DB::table('Transaction')->where('sellerUserId', $sellerUserId)->where(fn (Builder $q) => $q
            ->where(fn (Builder $meetup) => $meetup->whereIn('status', ['accepted', 'negotiating'])->whereNotNull('sellerMeetupConfirmedAt')->whereNull('buyerMeetupConfirmedAt'))
            ->orWhere(fn (Builder $done) => $done->where('status', 'for_meetup')->whereNotNull('sellerCompletionConfirmedAt')->whereNull('buyerCompletionConfirmedAt'))
        )->count();
    }

    /** Per-listing performance for the window, best sellers first. */
    private function listings(int $sellerUserId, int $storeId, AnalyticsRange $range): array
    {
        [$from, $to] = $range->utcBounds();
        $rows = DB::table('Listing as li')->leftJoin('ListingInventory as inv', 'inv.listingId', '=', 'li.id')
            ->leftJoin('ListingViewCounter as vc', 'vc.listingId', '=', 'li.id')
            ->where('li.sellerProfileId', $storeId)->whereNull('li.deletedAt')
            ->get(['li.id', 'li.title', 'li.type', 'li.status', 'li.availabilityState', 'li.price', 'inv.availableQuantity', 'vc.viewCount']);
        if ($rows->isEmpty()) {
            return [];
        }
        $ids = $rows->pluck('id')->all();
        $count = fn (string $table, ?callable $scope = null) => DB::table($table)->whereIn('listingId', $ids)
            ->when($scope, $scope)->selectRaw('listingId, COUNT(*) AS n')->groupBy('listingId')->pluck('n', 'listingId');
        $inquiries = $count('InquiryThread', fn ($q) => $q->where('createdAt', '>=', $from)->where('createdAt', '<', $to));
        $orders = $count('Transaction', fn ($q) => $q->where('sellerUserId', $sellerUserId)->where('createdAt', '>=', $from)->where('createdAt', '<', $to));
        $saves = $count('SavedListing');
        $likes = $count('ListingAppreciation');
        $views = $this->views($storeId, $range)->selectRaw('d.listingId, SUM(d.viewCount) AS n')->groupBy('d.listingId')->pluck('n', 'd.listingId');
        $completed = $this->completions($from, $to)->where('t.sellerUserId', $sellerUserId)
            ->selectRaw('t.listingId, COUNT(*) AS n, SUM(t.price) AS sales')->groupBy('t.listingId')->get()->keyBy('listingId');

        $out = $rows->map(function ($row) use ($inquiries, $orders, $saves, $likes, $views, $completed) {
            $stock = $row->availableQuantity === null ? null : (int) $row->availableQuantity;
            $done = $completed[$row->id] ?? null;

            return [
                'id' => (int) $row->id,
                'title' => $row->title,
                'type' => $row->type,
                'status' => $row->status,
                'availabilityState' => $row->availabilityState,
                'price' => round((float) $row->price, 2),
                'stock' => $stock,
                'lowStock' => $row->type === 'physical_product' && $row->status === 'published' && $stock !== null && $stock <= self::LOW_STOCK_THRESHOLD,
                'views' => (int) ($views[$row->id] ?? 0),
                'totalViews' => (int) ($row->viewCount ?? 0),
                'inquiries' => (int) ($inquiries[$row->id] ?? 0),
                'orders' => (int) ($orders[$row->id] ?? 0),
                'completedOrders' => $done ? (int) $done->n : 0,
                'reportedSales' => $done ? round((float) $done->sales, 2) : 0.0,
                'saves' => (int) ($saves[$row->id] ?? 0),
                'likes' => (int) ($likes[$row->id] ?? 0),
            ];
        })->all();
        usort($out, fn (array $a, array $b) => [$b['reportedSales'], $b['completedOrders'], $b['orders'], $b['views'], $a['id']]
            <=> [$a['reportedSales'], $a['completedOrders'], $a['orders'], $a['views'], $b['id']]);

        return $out;
    }

    private function rating(int $storeId): array
    {
        $rows = DB::table('StoreReview')->where('sellerProfileId', $storeId)->where('status', 'published')
            ->selectRaw('rating, COUNT(*) AS n')->groupBy('rating')->pluck('n', 'rating');
        $count = (int) $rows->sum();
        $total = 0;
        $distribution = [];
        foreach ([5, 4, 3, 2, 1] as $stars) {
            $distribution[(string) $stars] = (int) ($rows[$stars] ?? 0);
            $total += $stars * $distribution[(string) $stars];
        }

        return ['average' => $count > 0 ? round($total / $count, 2) : null, 'count' => $count, 'distribution' => $distribution];
    }

    private function viewsTrackedSince(int $storeId): ?string
    {
        $first = DB::table('ListingViewDaily as d')->join('Listing as li', 'li.id', '=', 'd.listingId')
            ->where('li.sellerProfileId', $storeId)->min('d.day');

        return $first === null ? null : (string) $first;
    }

    /** Daily unique views of the store's listings inside the window (campus-local days). */
    private function views(int $storeId, AnalyticsRange $range): Builder
    {
        return DB::table('ListingViewDaily as d')->join('Listing as li', 'li.id', '=', 'd.listingId')
            ->where('li.sellerProfileId', $storeId)
            ->whereBetween('d.day', $range->localDays());
    }

    /** Orders whose completion was confirmed inside [from, to). Alias t = order, l = status log. */
    private function completions(string $from, string $to): Builder
    {
        return DB::table('Transaction as t')->join('TransactionStatusLog as l', 'l.transactionId', '=', 't.id')
            ->where('l.toStatus', 'completed')->where('t.status', 'completed')
            ->where('l.createdAt', '>=', $from)->where('l.createdAt', '<', $to);
    }

    /** Orders cancelled or declined inside [from, to). */
    private function cancellations(string $from, string $to): Builder
    {
        return DB::table('Transaction as t')->join('TransactionStatusLog as l', 'l.transactionId', '=', 't.id')
            ->where('l.toStatus', 'cancelled')->where('l.createdAt', '>=', $from)->where('l.createdAt', '<', $to);
    }

    /** Active orders waiting on the seller: a decision, a meetup confirmation or a completion confirmation. */
    private function sellerTurn(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->where('t.status', 'pending')
            ->orWhere(fn (Builder $meetup) => $meetup->whereIn('t.status', ['accepted', 'negotiating'])->whereNull('t.sellerMeetupConfirmedAt'))
            ->orWhere(fn (Builder $done) => $done->where('t.status', 'for_meetup')->whereNull('t.sellerCompletionConfirmedAt')));
    }

    private static function iso(?string $value): ?string
    {
        return $value === null ? null : str_replace(' ', 'T', substr($value, 0, 23)).'Z';
    }
}
