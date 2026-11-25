<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Analytics\MarketplaceAnalytics;
use App\Support\AnalyticsRange;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/v1/admin/analytics/dashboard?range=7d|30d|90d|12m — limited to the reviewer's campuses. */
class AdminAnalyticsController extends Controller
{
    public function __construct(private readonly MarketplaceAnalytics $analytics) {}

    public function show(Request $request): JsonResponse
    {
        $query = ApiQuery::all($request);
        ApiQuery::strictKeys($query, ['range']);
        $range = AnalyticsRange::fromQuery($query);
        $campusIds = Permissions::reviewCampusIds($request->attributes->get('authUser'));

        return ApiResponse::json($this->analytics->build($campusIds, $range), 200, ['Cache-Control' => 'private, no-store']);
    }
}
