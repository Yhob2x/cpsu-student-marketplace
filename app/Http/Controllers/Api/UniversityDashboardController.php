<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Analytics\UniversityDashboard;
use App\Support\AnalyticsRange;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class UniversityDashboardController extends Controller
{
    public function show(Request $request, UniversityDashboard $dashboard): JsonResponse
    {
        $query = ApiQuery::all($request);
        ApiQuery::strictKeys($query, ['period']);
        $period = ApiQuery::enum($query, 'period', array_keys(AnalyticsRange::RANGES), '30d');

        $payload = Cache::remember('university-dashboard:'.$period, 60, function () use ($dashboard, $period) {
            return $dashboard->build(AnalyticsRange::make($period, CarbonImmutable::now(AnalyticsRange::TIMEZONE)));
        });

        return ApiResponse::json($payload, 200, ['Cache-Control' => 'private, no-store']);
    }
}
