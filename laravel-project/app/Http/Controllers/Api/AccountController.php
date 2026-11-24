<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\Report;
use App\Models\SavedListing;
use App\Models\SellerProfile;
use App\Models\User;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class AccountController extends Controller
{
    private const MESSAGE_TYPES = ['inquiry.new', 'inquiry.reply'];

    public function me(Request $request): JsonResponse
    {
        $user = $request->attributes->get('authUser');
        $affiliations = Affiliation::query()->where('userId', $user->id)->with('campus:id,name')->orderBy('id')->get();
        $store = SellerProfile::query()->where('ownerUserId', $user->id)->first(['id']);

        return ApiResponse::json([
            'id' => $user->id,
            'email' => $user->email,
            'displayName' => $user->displayName,
            'roles' => $user->roles,
            'affiliations' => $affiliations->map(fn ($row) => [
                'id' => $row->id,
                'campus' => ['id' => $row->campus->id, 'name' => $row->campus->name],
                'status' => $row->verificationStatus->value,
            ])->all(),
            'storeId' => $store?->id,
        ]);
    }

    public function updateMe(Request $request): JsonResponse
    {
        $displayName = ApiInput::string(ApiInput::object($request), 'displayName', 2, 80, true);
        User::query()->whereKey($request->attributes->get('authUser')->id)->update(['displayName' => $displayName]);

        return ApiResponse::json(['ok' => true]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $query = fn () => Notification::query()->where('userId', $request->attributes->get('authUser')->id)->whereNull('readAt');

        return ApiResponse::json([
            'total' => $query()->count(),
            'messages' => $query()->whereIn('type', self::MESSAGE_TYPES)->count(),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function notifications(Request $request): JsonResponse
    {
        $rows = Notification::query()->where('userId', $request->attributes->get('authUser')->id)->orderByDesc('createdAt')->orderBy('id')->limit(50)->get();

        return ApiResponse::json($rows->map(function ($row) {
            $raw = $row->getRawOriginal('payload');

            return ['payload' => $raw === null ? null : json_decode($raw)] + $row->toArray();
        })->all(), 200, ['Cache-Control' => 'no-store']);
    }

    public function readAll(Request $request): Response
    {
        Notification::query()->where('userId', $request->attributes->get('authUser')->id)->whereNull('readAt')->update(['readAt' => ListingAccess::now()]);

        return response()->noContent();
    }

    public function readOne(Request $request, string $id): Response
    {
        $number = ApiInput::jsNumber($id);
        if ($number === null || ! is_finite($number) || floor($number) !== $number) {
            throw new ApiError(400, 'invalid_id');
        }

        // Scoped to the owner: another student's notification simply matches nothing.
        Notification::query()->whereKey(abs($number) > 9007199254740991 ? PHP_INT_MAX : (int) $number)
            ->where('userId', $request->attributes->get('authUser')->id)->whereNull('readAt')->update(['readAt' => ListingAccess::now()]);

        return response()->noContent();
    }

    public function saved(Request $request): JsonResponse
    {
        $rows = SavedListing::query()->where('userId', $request->attributes->get('authUser')->id)
            ->whereHas('listing', fn ($listing) => ListingAccess::publicListing($listing))
            ->with(array_map(fn ($relation) => "listing.{$relation}", ListingPresenter::RELATIONS))
            ->orderByDesc('createdAt')->get();

        return ApiResponse::json($rows->map(fn ($row) => ListingPresenter::present($row->listing, null, []))->all());
    }

    public function save(Request $request, string $listingId): Response
    {
        $id = ApiInput::routeInt($listingId);
        $userId = $request->attributes->get('authUser')->id;
        $listing = ListingAccess::publicListing(Listing::query()->whereKey($id))->with('seller:id,ownerUserId')->first();
        if ($listing === null) {
            throw new ApiError(404, 'not_found');
        }
        if ($listing->seller->ownerUserId === $userId) {
            throw new ApiError(400, 'own_listing');
        }
        if ($listing->availabilityState->value !== 'available') {
            throw new ApiError(409, 'listing_unavailable');
        }

        SavedListing::query()->firstOrCreate(['userId' => $userId, 'listingId' => $listing->id]);

        return response()->noContent();
    }

    public function unsave(Request $request, string $listingId): Response
    {
        SavedListing::query()->where('userId', $request->attributes->get('authUser')->id)->where('listingId', ApiInput::routeInt($listingId))->delete();

        return response()->noContent();
    }

    /** A report targets exactly one public listing or store, never private conversations. */
    public function report(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['listingId', 'sellerProfileId', 'reason']);
        $listingId = array_key_exists('listingId', $body) ? ApiInput::positiveInteger($body, 'listingId') : null;
        $sellerId = array_key_exists('sellerProfileId', $body) ? ApiInput::positiveInteger($body, 'sellerProfileId') : null;
        $reason = ApiInput::string($body, 'reason', 10, 1000, true);
        if (($listingId === null) === ($sellerId === null)) {
            throw ApiInput::invalid('body', 'Specify exactly one public report target.', 'custom');
        }

        $userId = $request->attributes->get('authUser')->id;
        if ($listingId !== null) {
            $listing = ListingAccess::publicListing(Listing::query()->whereKey($listingId))->with('seller:id,ownerUserId')->first();
            if ($listing === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($listing->seller->ownerUserId === $userId) {
                throw new ApiError(400, 'own_listing');
            }
            $target = ['listingId' => $listing->id];
        } else {
            $seller = ListingAccess::visibleStore(SellerProfile::query()->whereKey($sellerId))->first(['id', 'ownerUserId']);
            if ($seller === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($seller->ownerUserId === $userId) {
                throw new ApiError(400, 'own_store');
            }
            $target = ['sellerProfileId' => $seller->id];
        }

        $report = DB::transaction(function () use ($userId, $target, $reason) {
            $report = Report::create(['reporterUserId' => $userId, 'reason' => $reason] + $target);
            AuditLog::create(['actorUserId' => $userId, 'action' => 'report.create', 'targetType' => 'report', 'targetId' => $report->id]);

            return $report;
        });

        return ApiResponse::json(['id' => $report->id], 201);
    }
}
