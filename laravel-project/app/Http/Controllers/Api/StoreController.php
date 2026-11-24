<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Models\ListingAppreciation;
use App\Models\SellerProfile;
use App\Models\StoreFollow;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPresenter;
use App\Support\StoreSlug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreController extends Controller
{
    private const CONNECTIONS_PAGE_SIZE = 6;

    public function mostFollowed(): JsonResponse
    {
        $available = fn ($listing) => $listing->where('status', 'published')->where('availabilityState', 'available')->whereNull('deletedAt');
        $stores = ListingAccess::visibleStore(SellerProfile::query())
            ->whereHas('listings', $available)
            ->whereHas('storeFollows')
            ->withCount(['storeFollows as followerCount', 'listings as listingCount' => $available])
            ->with('campus:id,name,code')
            ->orderByDesc('followerCount')->orderBy('id')->limit(4)
            ->get(['id', 'storeName', 'avatarPath', 'campusId']);

        return ApiResponse::json([
            'available' => true,
            'items' => $stores->map(fn ($store) => [
                'id' => $store->id,
                'storeName' => $store->storeName,
                'campus' => ['name' => $store->campus->name, 'code' => $store->campus->code],
                'avatarUrl' => ListingPresenter::avatarUrl($store->id, $store->avatarPath),
                'followerCount' => (int) $store->followerCount,
                'listingCount' => (int) $store->listingCount,
            ])->all(),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function bySlug(Request $request, string $slug): JsonResponse
    {
        if ($slug === '' || ApiInput::length($slug) > 200) {
            throw new ApiError(404, 'not_found');
        }

        $stores = $this->visibleStoreNames();
        $store = StoreSlug::find($stores, $slug);
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        return $this->publicStore($request, $store['id'], $stores);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $number = ApiInput::jsNumber($id);
        if ($number === null || ! is_finite($number) || floor($number) !== $number || $number < 1 || $number > 9007199254740991) {
            throw new ApiError(404, 'not_found');
        }
        return $this->publicStore($request, (int) $number);
    }

    /** Exposes active followers' display names only, never account or contact details. */
    public function connections(Request $request, string $id): JsonResponse
    {
        $storeId = ApiInput::positiveId($id);
        $input = ApiQuery::all($request);
        $page = ApiQuery::int($input, 'page', 1, 1, 10000);
        $view = ApiQuery::enum($input, 'view', ['followers', 'following'], 'followers');
        $countsOnly = ApiQuery::enum($input, 'countsOnly', ['true']) === 'true';

        $store = ListingAccess::visibleStore(SellerProfile::query()->whereKey($storeId))->first(['id', 'ownerUserId']);
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        $followers = fn () => StoreFollow::query()->where('sellerProfileId', $storeId)->whereHas('user', fn ($user) => $user->where('status', 'active'));
        $following = fn () => StoreFollow::query()->where('userId', $store->ownerUserId)->whereHas('store', fn ($followed) => ListingAccess::visibleStore($followed));
        $followerCount = $followers()->count();
        $followingCount = $following()->count();
        $headers = ['Cache-Control' => 'no-store'];
        if ($countsOnly) {
            return ApiResponse::json(compact('followerCount', 'followingCount'), 200, $headers);
        }

        $offset = ($page - 1) * self::CONNECTIONS_PAGE_SIZE;
        $base = ['followerCount' => $followerCount, 'followingCount' => $followingCount, 'page' => $page, 'pageSize' => self::CONNECTIONS_PAGE_SIZE];
        if ($view === 'following') {
            $rows = $following()->with('store:id,storeName,campusId', 'store.campus:id,name')->orderByDesc('createdAt')->orderByDesc('sellerProfileId')
                ->offset($offset)->limit(self::CONNECTIONS_PAGE_SIZE)->get();

            return ApiResponse::json(['total' => $followingCount] + $base + ['items' => $rows->map(fn ($row) => [
                'storeId' => $row->store->id,
                'storeName' => $row->store->storeName,
                'campusName' => $row->store->campus->name,
                'followedAt' => ApiResponse::date($row->createdAt),
            ])->all()], 200, $headers);
        }

        $rows = $followers()->with('user:id,displayName')->orderByDesc('createdAt')->orderByDesc('userId')
            ->offset($offset)->limit(self::CONNECTIONS_PAGE_SIZE)->get();

        return ApiResponse::json(['total' => $followerCount] + $base + ['items' => $rows->map(fn ($row) => [
            'displayName' => $row->user->displayName,
            'followedAt' => ApiResponse::date($row->createdAt),
        ])->all()], 200, $headers);
    }

    private function visibleStoreNames(): array
    {
        return ListingAccess::visibleStore(SellerProfile::query())->orderBy('id')->get(['id', 'storeName'])
            ->map(fn ($store) => ['id' => $store->id, 'storeName' => $store->storeName])->all();
    }

    private function publicStore(Request $request, int $id, ?array $stores = null): JsonResponse
    {
        $input = ApiQuery::all($request);
        $limit = ApiQuery::int($input, 'limit', null, 1, 48);
        $beforeId = ApiQuery::int($input, 'beforeId', null, 1, 2147483647);
        if ($beforeId !== null && $limit === null) {
            throw ApiInput::invalid('beforeId', 'beforeId requires limit', 'custom');
        }

        $store = ListingAccess::visibleStore(SellerProfile::query()->whereKey($id))->with('campus:id,code,name')->first();
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        $listingQuery = Listing::query()->where('sellerProfileId', $store->id)->where('status', 'published')->whereNull('deletedAt')->where('availabilityState', 'available');
        if ($limit !== null) {
            if ($beforeId !== null) {
                $listingQuery->where('id', '<', $beforeId);
            }
            $listingQuery->orderByDesc('id')->limit($limit + 1);
        } else {
            $listingQuery->orderByDesc('createdAt')->orderByDesc('id');
        }
        $rows = $listingQuery->with(ListingPresenter::RELATIONS)->get();

        $stores ??= $this->visibleStoreNames();
        $slug = StoreSlug::canonical($stores, ['id' => $store->id, 'storeName' => $store->storeName]);
        $follow = ListingPresenter::followSummary($store->id, $request->attributes->get('authUser')?->id);
        $publishedCount = Listing::query()->where('sellerProfileId', $store->id)->where('status', 'published')->whereNull('deletedAt')->count();
        $availableCount = $limit !== null
            ? Listing::query()->where('sellerProfileId', $store->id)->where('status', 'published')->whereNull('deletedAt')->where('availabilityState', 'available')->count()
            : $rows->count();
        $appreciationCount = ListingAppreciation::query()->whereHas('listing', fn ($listing) => $listing->where('sellerProfileId', $store->id)->where('status', 'published')->whereNull('deletedAt'))->count();
        $stocks = ListingPresenter::stocks($rows->pluck('id')->all());
        $activity = ListingPresenter::activityBadge($publishedCount, $follow['count']);
        $isStudent = $store->sellerType->value === 'student';

        $items = $limit !== null ? $rows->take($limit)->values() : $rows;
        $body = [
            'id' => $store->id,
            'slug' => $slug,
            'storeName' => $store->storeName,
            'description' => $store->description,
            'sellerType' => $store->sellerType->value,
            'campusId' => $store->campusId,
            'campus' => ['code' => $store->campus->code, 'name' => $store->campus->name],
            'createdAt' => ApiResponse::date($store->createdAt),
            'listingCount' => $availableCount,
            'appreciationCount' => $appreciationCount,
            'follow' => $follow,
            'avatarUrl' => ListingPresenter::avatarUrl($store->id, $store->avatarPath),
            'badge' => $isStudent ? $activity['label'] : 'Campus establishment',
        ];
        if ($isStudent) {
            $body['badgeReason'] = $activity['reason'];
        }
        $body['listings'] = $items->map(fn ($row) => ListingPresenter::present($row, null, $stocks))->all();
        if ($limit !== null) {
            $hasMore = $rows->count() > $limit;
            $body['hasMoreListings'] = $hasMore;
            $body['nextListingBeforeId'] = $hasMore ? $items->last()?->id : null;
        }

        return ApiResponse::json($body, 200, ['Cache-Control' => 'private, no-store']);
    }
}
