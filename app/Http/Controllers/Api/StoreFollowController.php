<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerProfile;
use App\Models\StoreFollow;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreFollowController extends Controller
{
    private const PAGE_SIZE = 6;

    /** Owner-only list. Never exposes follower email, student ID, legal name or affiliation. */
    public function mine(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        $page = ApiQuery::int($input, 'page', 1, 1, 10000);
        $view = ApiQuery::enum($input, 'view', ['followers', 'following'], 'followers');
        $countsOnly = ApiQuery::enum($input, 'countsOnly', ['true']) === 'true';
        $userId = $request->attributes->get('authUser')->id;

        $store = SellerProfile::query()->where('ownerUserId', $userId)->first(['id']);
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        $followers = fn () => StoreFollow::query()->where('sellerProfileId', $store->id);
        $following = fn () => StoreFollow::query()->where('userId', $userId)->whereHas('store', fn ($followed) => ListingAccess::visibleStore($followed));
        $followerCount = $followers()->count();
        $followingCount = $following()->count();
        $headers = ['Cache-Control' => 'private, no-store'];
        if ($countsOnly) {
            return ApiResponse::json(compact('followerCount', 'followingCount'), 200, $headers);
        }

        $offset = ($page - 1) * self::PAGE_SIZE;
        if ($view === 'following') {
            $rows = $following()->with('store:id,storeName,campusId', 'store.campus:id,name')->orderByDesc('createdAt')->orderByDesc('sellerProfileId')
                ->offset($offset)->limit(self::PAGE_SIZE)->get();

            return ApiResponse::json([
                'total' => $followingCount, 'followerCount' => $followerCount, 'followingCount' => $followingCount, 'page' => $page, 'pageSize' => self::PAGE_SIZE,
                'items' => $rows->map(fn ($row) => [
                    'storeId' => $row->store->id,
                    'storeName' => $row->store->storeName,
                    'campusName' => $row->store->campus->name,
                    'followedAt' => ApiResponse::date($row->createdAt),
                ])->all(),
            ], 200, $headers);
        }

        $rows = $followers()->with('user:id,displayName')->orderByDesc('createdAt')->orderByDesc('userId')->offset($offset)->limit(self::PAGE_SIZE)->get();

        return ApiResponse::json([
            'total' => $followerCount, 'followingCount' => $followingCount, 'page' => $page, 'pageSize' => self::PAGE_SIZE,
            'items' => $rows->map(fn ($row) => ['displayName' => $row->user->displayName, 'followedAt' => ApiResponse::date($row->createdAt)])->all(),
        ], 200, $headers);
    }

    public function follow(Request $request, string $id): JsonResponse
    {
        $storeId = ApiInput::positiveId($id);
        $userId = $request->attributes->get('authUser')->id;
        $store = $this->followableStore($storeId);
        if ($store->ownerUserId === $userId) {
            throw new ApiError(400, 'own_store_follow');
        }

        StoreFollow::query()->insertOrIgnore(['userId' => $userId, 'sellerProfileId' => $storeId, 'createdAt' => ListingAccess::now()]);

        return $this->summary($storeId, $userId);
    }

    public function unfollow(Request $request, string $id): JsonResponse
    {
        $storeId = ApiInput::positiveId($id);
        $userId = $request->attributes->get('authUser')->id;
        $this->followableStore($storeId);
        StoreFollow::query()->where('userId', $userId)->where('sellerProfileId', $storeId)->delete();

        return $this->summary($storeId, $userId);
    }

    private function followableStore(int $id): SellerProfile
    {
        $store = ListingAccess::visibleStore(SellerProfile::query()->whereKey($id))->first(['id', 'ownerUserId']);
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        return $store;
    }

    private function summary(int $storeId, int $userId): JsonResponse
    {
        $summary = ListingPresenter::followSummary($storeId, $userId);

        return ApiResponse::json(['count' => $summary['count'], 'isFollowing' => $summary['isFollowing']], 200, ['Cache-Control' => 'private, no-store']);
    }
}
