<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\Listing;
use App\Models\ListingAppreciation;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Cookie;

class ListingEngagementController extends Controller
{
    private const VIEW_COOKIE = 'cpsu_listing_visitor';

    public function appreciationSummaries(Request $request): JsonResponse
    {
        $ids = $this->batchIds($request);
        $visible = ListingAccess::publicListing(Listing::query()->whereIn('id', $ids))->pluck('id')->all();

        return ApiResponse::json(['summaries' => (object) $this->summaries($visible, $request->attributes->get('authUser')?->id)], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function appreciation(Request $request, string $id): JsonResponse
    {
        $listingId = ApiInput::positiveId($id);
        $this->publicListing($listingId);

        return ApiResponse::json($this->summaries([$listingId], $request->attributes->get('authUser')?->id)[$listingId], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function appreciate(Request $request, string $id): JsonResponse
    {
        $listingId = ApiInput::positiveId($id);
        $userId = $request->attributes->get('authUser')->id;
        $listing = $this->publicListing($listingId);
        if ($listing->seller->ownerUserId === $userId) {
            throw new ApiError(403, 'cannot_appreciate_own_listing');
        }

        $verified = ListingAccess::currentAffiliation(Affiliation::query()->where('userId', $userId))
            ->whereHas('campus', fn ($campus) => $campus->where('active', true))->exists();
        if (! $verified) {
            throw new ApiError(403, 'verified_student_required');
        }

        ListingAppreciation::query()->insertOrIgnore(['userId' => $userId, 'listingId' => $listingId, 'createdAt' => ListingAccess::now()]);

        return ApiResponse::json($this->summaries([$listingId], $userId)[$listingId], 200, ['Cache-Control' => 'private, no-store']);
    }

    /** Withdrawals remain possible after a student affiliation expires. */
    public function withdraw(Request $request, string $id): JsonResponse
    {
        $listingId = ApiInput::positiveId($id);
        $userId = $request->attributes->get('authUser')->id;
        $listing = $this->publicListing($listingId);
        if ($listing->seller->ownerUserId === $userId) {
            throw new ApiError(403, 'cannot_appreciate_own_listing');
        }

        ListingAppreciation::query()->where('listingId', $listingId)->where('userId', $userId)->delete();

        return ApiResponse::json($this->summaries([$listingId], $userId)[$listingId], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function viewCounts(Request $request): JsonResponse
    {
        $ids = $this->batchIds($request);
        $visible = ListingAccess::publicListing(Listing::query()->whereIn('id', $ids))->pluck('id')->all();

        return ApiResponse::json(['views' => (object) $this->viewSummaries($visible)], 200, ['Cache-Control' => 'no-store']);
    }

    /** A view is a deliberate detail-page visit. Raw visitor tokens are never stored. */
    public function recordView(Request $request, string $id): JsonResponse
    {
        if ($request->header('Sec-Fetch-Site') === 'cross-site') {
            throw new ApiError(403, 'forbidden');
        }

        $listingId = ApiInput::positiveId($id);
        $listing = ListingAccess::availablePublicListing(Listing::query()->whereKey($listingId))->with('seller:id,ownerUserId')->first();
        if ($listing === null) {
            throw new ApiError(404, 'listing_not_available');
        }

        $user = $request->attributes->get('authUser');
        if ($user !== null && ($user->id === $listing->seller->ownerUserId || $user->roles !== [])) {
            return ApiResponse::json($this->viewSummaries([$listingId])[$listingId] + ['recorded' => false]);
        }

        $previous = $request->cookies->get(self::VIEW_COOKIE);
        $token = is_string($previous) && preg_match('/^[a-f0-9]{48}\z/', $previous) === 1 ? $previous : bin2hex(random_bytes(24));
        $digest = hash_hmac('sha256', "{$listingId}:".gmdate('Y-m-d').":{$token}", (string) config('marketplace.jwt_secret'));

        $result = DB::transaction(function () use ($listingId, $digest) {
            $inserted = DB::affectingStatement('INSERT IGNORE INTO `ListingViewDedup` (listingId, viewerHash, createdAt) VALUES (?, ?, UTC_TIMESTAMP(3))', [$listingId, $digest]);
            if ($inserted === 1) {
                DB::statement('INSERT INTO `ListingViewCounter` (listingId, viewCount) VALUES (?, 1) ON DUPLICATE KEY UPDATE viewCount = viewCount + 1', [$listingId]);
            }
            $row = DB::selectOne('SELECT viewCount FROM `ListingViewCounter` WHERE listingId = ?', [$listingId]);

            return ['count' => $row ? max(0, (int) $row->viewCount) : 0, 'recorded' => $inserted === 1];
        });
        DB::delete('DELETE FROM `ListingViewDedup` WHERE createdAt < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY) LIMIT 200');

        $response = ApiResponse::json(['available' => true] + $result, 200, ['Cache-Control' => 'no-store']);
        if ($token !== $previous) {
            $response->headers->setCookie(Cookie::create(self::VIEW_COOKIE, $token, time() + 86400, '/api/v1/listings', null, (bool) config('marketplace.cookie_secure'), true, true, Cookie::SAMESITE_LAX));
        }

        return $response;
    }

    private function batchIds(Request $request): array
    {
        $raw = ApiQuery::all($request)['ids'] ?? null;
        if (! is_string($raw) || ApiInput::length($raw) > 600) {
            throw ApiInput::invalid('ids', 'Invalid listing ids');
        }

        $ids = array_values(array_unique(array_map(fn ($value) => ApiInput::positiveId($value), explode(',', $raw))));
        if ($ids === [] || count($ids) > 50) {
            throw new ApiError(400, 'invalid_listing_ids');
        }

        return $ids;
    }

    private function publicListing(int $id): Listing
    {
        $listing = ListingAccess::publicListing(Listing::query()->whereKey($id))->with('seller:id,ownerUserId')->first();
        if ($listing === null) {
            throw new ApiError(404, 'listing_not_available');
        }

        return $listing;
    }

    private function summaries(array $ids, ?int $viewerId): array
    {
        if ($ids === []) {
            return [];
        }

        $counts = ListingAppreciation::query()->toBase()->selectRaw('listingId, COUNT(*) AS total')->whereIn('listingId', $ids)->groupBy('listingId')->pluck('total', 'listingId');
        $own = $viewerId !== null ? ListingAppreciation::query()->whereIn('listingId', $ids)->where('userId', $viewerId)->pluck('listingId')->flip() : collect();
        $result = [];
        foreach ($ids as $id) {
            $result[$id] = ['available' => true, 'count' => (int) ($counts[$id] ?? 0), 'isAppreciated' => $own->has($id)];
        }

        return $result;
    }

    private function viewSummaries(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $counts = DB::table('ListingViewCounter')->whereIn('listingId', $ids)->pluck('viewCount', 'listingId');
        $result = [];
        foreach ($ids as $id) {
            $result[$id] = ['available' => true, 'count' => max(0, (int) ($counts[$id] ?? 0))];
        }

        return $result;
    }
}
