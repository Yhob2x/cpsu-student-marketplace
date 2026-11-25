<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SellerProfile;
use App\Services\Analytics\SellerAnalytics;
use App\Support\AnalyticsRange;
use App\Support\ApiError;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/v1/seller/analytics?range=7d|30d|90d|12m — the signed-in seller's own store only. */
class SellerAnalyticsController extends Controller
{
    public function __construct(private readonly SellerAnalytics $analytics) {}

    public function show(Request $request): JsonResponse
    {
        $query = ApiQuery::all($request);
        ApiQuery::strictKeys($query, ['range']);
        $range = AnalyticsRange::fromQuery($query);

        $userId = $request->attributes->get('authUser')->id;
        $store = SellerProfile::query()->where('ownerUserId', $userId)->first(['id']);
        if ($store === null) {
            throw new ApiError(404, 'no_store');
        }

        return ApiResponse::json($this->analytics->build($userId, $store->id, $range), 200, ['Cache-Control' => 'private, no-store']);
    }
}
