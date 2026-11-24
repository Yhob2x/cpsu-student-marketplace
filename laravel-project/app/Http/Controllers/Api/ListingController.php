<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Listing;
use App\Models\SellerProfile;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPayload;
use App\Support\ListingPresenter;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        $text = ApiQuery::string($input, 'q', 80);
        $categoryId = ApiQuery::int($input, 'categoryId');
        $campusId = ApiQuery::int($input, 'campusId');
        $type = ApiQuery::enum($input, 'type', ListingPayload::TYPES);
        $sellerType = ApiQuery::enum($input, 'sellerType', ['student', 'establishment']);
        $condition = ApiQuery::enum($input, 'condition', ListingPayload::CONDITIONS);
        $minPrice = ApiQuery::number($input, 'minPrice', 0);
        $maxPrice = ApiQuery::number($input, 'maxPrice', 0);
        $sort = ApiQuery::enum($input, 'sort', ['newest', 'price_asc', 'price_desc'], 'newest');
        $page = ApiQuery::int($input, 'page', 1, 1);
        $pageSize = ApiQuery::int($input, 'pageSize', 20, 1, 50);

        $query = Listing::query()->where('status', 'published')->where('availabilityState', 'available')->whereNull('deletedAt')
            ->whereHas('seller', function ($seller) use ($sellerType) {
                ListingAccess::visibleStore($seller);
                if ($sellerType !== null) {
                    $seller->where('sellerType', $sellerType);
                }
            });

        if ($text !== null && $text !== '') {
            $query->where(fn ($match) => $match->where('title', 'like', "%{$text}%")->orWhere('description', 'like', "%{$text}%"));
        }
        if ($categoryId) {
            $query->where('categoryId', $categoryId);
        }
        if ($campusId) {
            $query->where('campusId', $campusId);
        }
        // A condition applies only to products, so it takes precedence over a type filter.
        if ($condition !== null) {
            $query->where('condition', $condition)->where('type', 'physical_product');
        } elseif ($type !== null) {
            $query->where('type', $type);
        }
        if ($minPrice !== null) {
            $query->where('price', '>=', $minPrice);
        }
        if ($maxPrice !== null) {
            $query->where('price', '<=', $maxPrice);
        }

        $total = (clone $query)->count();
        match ($sort) {
            'price_asc' => $query->orderBy('price')->orderByDesc('id'),
            'price_desc' => $query->orderByDesc('price')->orderByDesc('id'),
            default => $query->orderByDesc('createdAt')->orderByDesc('id'),
        };
        $rows = $query->with(ListingPresenter::RELATIONS)->offset(($page - 1) * $pageSize)->limit($pageSize)->get();
        $ratings = ListingPresenter::ratings($rows->pluck('sellerProfileId')->all());
        $stocks = ListingPresenter::stocks($rows->pluck('id')->all());

        return ApiResponse::json([
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'items' => $rows->map(fn ($row) => ListingPresenter::present($row, $ratings, $stocks))->all(),
        ]);
    }

    public function popular(): JsonResponse
    {
        return ApiResponse::json([
            'ranking' => 'appreciations_and_views',
            'items' => ListingPresenter::ranked(ListingPresenter::popularIds()),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function fresh(): JsonResponse
    {
        return ApiResponse::json(['items' => ListingPresenter::ranked(ListingPresenter::freshIds())]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->attributes->get('authUser');
        $listing = ListingAccess::visibleRows(Listing::query()->whereKey(ApiInput::routeInt($id)), $user)
            ->with(ListingPresenter::RELATIONS)->first();
        if ($listing === null) {
            throw new ApiError(404, 'not_found');
        }

        $owner = $user !== null && SellerProfile::query()->whereKey($listing->sellerProfileId)->where('ownerUserId', $user->id)->exists();
        $reviewer = false;
        if ($user !== null) {
            $campuses = Permissions::reviewCampusIds($user);
            $reviewer = $campuses === 'all' || in_array($listing->campusId, $campuses, true);
        }

        $publiclyVisible = $listing->deletedAt === null && $listing->status->value === 'published'
            && $listing->seller->approvalStatus->value === 'approved' && $listing->seller->owner->status->value === 'active';
        if (! $publiclyVisible && ! $owner && ! $reviewer) {
            throw new ApiError(404, 'not_found');
        }

        $body = ListingPresenter::present($listing, null, ListingPresenter::stocks([$listing->id]));
        if ($owner || $reviewer) {
            $body['status'] = $listing->status->value;
        }

        return ApiResponse::json($body);
    }
}
