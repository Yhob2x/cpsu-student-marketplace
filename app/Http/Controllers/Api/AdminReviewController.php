<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\CampusPolicy;
use App\Models\InquiryThread;
use App\Models\Listing;
use App\Models\ListingReview;
use App\Models\Notification;
use App\Models\Report;
use App\Models\SellerProfile;
use App\Models\StoreFollow;
use App\Models\Transaction;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\Permissions;
use App\Support\Tx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/** Campus-scoped moderation. Records outside the reviewer's scope look like they do not exist. */
class AdminReviewController extends Controller
{
    private const DECISIONS = ['approved' => 'published', 'changes_requested' => 'changes_requested', 'rejected' => 'rejected'];

    private const STAFF_ROLES = ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'];

    public function queue(Request $request): JsonResponse
    {
        $user = $request->attributes->get('authUser');
        $listings = $this->campusScope(Listing::query(), $user)->where('status', 'pending_review')->whereNull('deletedAt')
            ->with(['category:id,name', 'seller:id,storeName', 'media' => fn ($media) => $media->orderBy('id'), 'campus:id,code'])
            ->orderBy('updatedAt')->get();
        $affiliations = $this->campusScope(Affiliation::query(), $user)->where('verificationStatus', 'pending')
            ->with('user:id,displayName,email', 'campus:id,code')->orderBy('id')->get();
        $reportsPending = $this->reportScope(Report::query(), $user)->whereIn('status', ['open', 'reviewing'])->count();

        return ApiResponse::json([
            'listings' => $listings->map(fn ($listing) => [
                'id' => $listing->id,
                'title' => $listing->title,
                'description' => $listing->description,
                'price' => (float) $listing->price,
                'type' => $listing->type->value,
                'flags' => $listing->flags ?? [],
                'category' => $listing->category->name,
                'store' => $listing->seller->storeName,
                'campus' => $listing->campus->code,
                'images' => $listing->media->map(fn ($item) => "/api/v1/media/{$item->id}")->all(),
            ])->all(),
            'affiliations' => $affiliations->map(fn ($row) => [
                'id' => $row->id,
                'user' => ['id' => $row->user->id, 'displayName' => $row->user->displayName, 'email' => $row->user->email],
                'campus' => $row->campus->code,
            ])->all(),
            'reportsPending' => $reportsPending,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function decideListing(Request $request, string $id): JsonResponse
    {
        $body = ApiInput::object($request);
        $decision = ApiInput::enum($body, 'decision', array_keys(self::DECISIONS));
        $reason = ApiInput::string($body, 'reason', 5, 1000, true);
        $photosReviewed = array_key_exists('photosReviewed', $body) ? ApiInput::boolean($body, 'photosReviewed') : null;
        $user = $request->attributes->get('authUser');

        $listing = $this->campusScope(Listing::query()->whereKey(ApiInput::routeInt($id)), $user)
            ->with(['seller.owner:id,status', 'media'])->first();
        if ($listing === null || ! Permissions::canReview($user, $listing->campusId)) {
            throw new ApiError(404, 'not_found');
        }
        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if ($listing->status->value !== 'pending_review') {
            throw new ApiError(409, 'not_pending');
        }
        // A human must inspect every photo before publication.
        if ($decision === 'approved' && ($photosReviewed !== true || $listing->media->isEmpty())) {
            throw new ApiError(422, 'photo_review_required', 'Inspect all listing photos and confirm they meet campus content rules before approval.');
        }
        if ($decision === 'approved' && in_array('academic_integrity_concern', $listing->flags ?? [], true) && ApiInput::length($reason) < 20) {
            throw new ApiError(422, 'reason_too_short', 'Flagged listings need a documented reason of at least 20 characters.');
        }

        $policy = CampusPolicy::query()->where('campusId', $listing->campusId)->orderByDesc('version')->first(['id']);
        $status = self::DECISIONS[$decision];

        // Publish, review, audit and follower notices commit together.
        Tx::serializable(function () use ($listing, $user, $decision, $reason, $policy, $status) {
            $changed = $this->campusScope(Listing::query()->whereKey($listing->id), $user)->where('status', 'pending_review')->whereNull('deletedAt')->update(['status' => $status]);
            if ($changed !== 1) {
                throw new ApiError(409, 'not_pending');
            }

            // A previously approved item that was edited again is not a new listing.
            $approvedBefore = $decision === 'approved' && ListingReview::query()->where('listingId', $listing->id)->where('decision', 'approved')->exists();
            ListingReview::create(['listingId' => $listing->id, 'reviewerId' => $user->id, 'decision' => $decision, 'reason' => $reason, 'policyVersionId' => $policy?->id]);

            $metadata = ($policy ? ['policyVersionId' => $policy->id] : []) + ($decision === 'approved' ? ['photosReviewed' => true, 'photoCount' => $listing->media->count()] : []);
            AuditLog::create(['actorUserId' => $user->id, 'action' => "listing.{$decision}", 'targetType' => 'listing', 'targetId' => $listing->id, 'metadata' => $metadata === [] ? (object) [] : $metadata]);
            Notification::create(['userId' => $listing->seller->ownerUserId, 'type' => 'listing.decision', 'payload' => ['listingId' => $listing->id, 'title' => $listing->title, 'decision' => $decision, 'reason' => $reason]]);

            if ($decision === 'approved' && ! $approvedBefore && $listing->availabilityState->value === 'available'
                && $listing->seller->approvalStatus->value === 'approved' && $listing->seller->owner->status->value === 'active') {
                $this->notifyFollowers($listing);
            }
        });

        return ApiResponse::json(['id' => $listing->id, 'status' => $status]);
    }

    public function verifyAffiliation(Request $request, string $id): JsonResponse
    {
        $body = ApiInput::object($request);
        $decision = ApiInput::enum($body, 'decision', ['verified', 'rejected']);
        $reason = ApiInput::string($body, 'reason', 3, 500, true);
        $user = $request->attributes->get('authUser');
        $query = fn () => $this->campusScope(Affiliation::query()->whereKey(ApiInput::routeInt($id)), $user);

        $affiliation = $query()->first();
        if ($affiliation === null || ! Permissions::canReview($user, $affiliation->campusId)) {
            throw new ApiError(404, 'not_found');
        }
        $updated = $query()->update(['verificationStatus' => $decision, 'verifiedAt' => $decision === 'verified' ? ListingAccess::now() : null]);
        if ($updated !== 1) {
            throw new ApiError(404, 'not_found');
        }

        AuditLog::create(['actorUserId' => $user->id, 'action' => "affiliation.{$decision}", 'targetType' => 'affiliation', 'targetId' => $affiliation->id, 'metadata' => ['reason' => $reason]]);
        Notification::create(['userId' => $affiliation->userId, 'type' => 'affiliation.decision', 'payload' => ['decision' => $decision, 'reason' => $reason]]);

        return ApiResponse::json(['id' => $affiliation->id, 'status' => $decision]);
    }

    public function suspendListing(Request $request, string $id): JsonResponse
    {
        $reason = ApiInput::string(ApiInput::object($request), 'reason', 5, 500, true);
        $user = $request->attributes->get('authUser');
        $listingId = ApiInput::routeInt($id);
        $listing = $this->campusScope(Listing::query()->whereKey($listingId), $user)->with('seller:id,ownerUserId')->first();
        if ($listing === null || ! Permissions::canReview($user, $listing->campusId)) {
            throw new ApiError(404, 'not_found');
        }
        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if ($this->campusScope(Listing::query()->whereKey($listing->id), $user)->whereNull('deletedAt')->update(['status' => 'suspended']) !== 1) {
            throw new ApiError(404, 'not_found');
        }

        AuditLog::create(['actorUserId' => $user->id, 'action' => 'listing.suspend', 'targetType' => 'listing', 'targetId' => $listing->id, 'metadata' => ['reason' => $reason]]);
        Notification::create(['userId' => $listing->seller->ownerUserId, 'type' => 'listing.suspended', 'payload' => ['listingId' => $listing->id, 'reason' => $reason]]);

        return ApiResponse::json(['id' => $listing->id, 'status' => 'suspended']);
    }

    /** Reviewers monitor status only, never chat, payment arrangements or private IDs. */
    public function transactions(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        ApiQuery::strictKeys($input, ['page', 'pageSize']);
        $page = ApiQuery::int($input, 'page', 1, 1, 1000);
        $pageSize = ApiQuery::int($input, 'pageSize', 20, 1, 30);
        $campuses = Permissions::reviewCampusIds($request->attributes->get('authUser'));
        $where = fn () => $campuses === 'all' ? Transaction::query() : Transaction::query()->whereHas('listing', fn ($listing) => $listing->whereIn('campusId', $campuses));
        $items = $where()->with('listing:id,title,type,campusId', 'listing.campus:id,code')->orderByDesc('id')->offset(($page - 1) * $pageSize)->limit($pageSize)
            ->get(['id', 'status', 'createdAt', 'updatedAt', 'listingId']);

        return ApiResponse::json([
            'items' => $items->map(fn ($row) => [
                'id' => $row->id,
                'status' => $row->status->value,
                'createdAt' => ApiResponse::date($row->createdAt),
                'updatedAt' => ApiResponse::date($row->updatedAt),
                'listing' => ['id' => $row->listing->id, 'title' => $row->listing->title, 'type' => $row->listing->type->value, 'campus' => ['code' => $row->listing->campus->code]],
            ])->all(),
            'total' => $where()->count(),
            'page' => $page,
            'pageSize' => $pageSize,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function reports(Request $request): JsonResponse
    {
        $rows = $this->reportScope(Report::query(), $request->attributes->get('authUser'))->whereIn('status', ['open', 'reviewing'])
            ->orderBy('createdAt')->limit(100)->get();

        return ApiResponse::json($rows->toArray());
    }

    public function resolveReport(Request $request, string $id): Response
    {
        $reportId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        $status = ApiInput::enum($body, 'status', ['resolved', 'dismissed']);
        $reason = ApiInput::string($body, 'reason', 10, 1000, true);
        $user = $request->attributes->get('authUser');
        $where = fn () => $this->reportScope(Report::query()->whereKey($reportId), $user);

        $report = $where()->first(['id', 'status']);
        if ($report === null) {
            throw new ApiError(404, 'not_found');
        }
        if (! in_array($report->status->value, ['open', 'reviewing'], true)) {
            throw new ApiError(409, 'already_resolved');
        }

        // A failed audit must not close the report.
        DB::transaction(function () use ($where, $status, $user, $reportId, $reason) {
            if ($where()->whereIn('status', ['open', 'reviewing'])->update(['status' => $status, 'assignedReviewerId' => $user->id]) !== 1) {
                throw new ApiError(409, 'already_resolved');
            }
            AuditLog::create(['actorUserId' => $user->id, 'action' => "report.{$status}", 'targetType' => 'report', 'targetId' => $reportId, 'metadata' => ['reason' => $reason]]);
        });

        return response()->noContent();
    }

    /** Counts below 5 are suppressed so small groups cannot be identified. */
    public function analytics(Request $request): JsonResponse
    {
        $campusIds = Permissions::reviewCampusIds($request->attributes->get('authUser'));
        $campuses = Campus::query()->where('active', true)->when($campusIds !== 'all', fn ($query) => $query->whereIn('id', $campusIds))->orderBy('id')->get();
        $activeSeller = fn ($seller) => $seller->where('approvalStatus', 'approved')->whereHas('owner', fn ($owner) => $owner->where('status', 'active'));
        $live = fn (int $campusId) => Listing::query()->where('campusId', $campusId)->where('status', 'published')->whereNull('deletedAt')->where('availabilityState', 'available')->whereHas('seller', $activeSeller);

        $out = [];
        foreach ($campuses as $campus) {
            $out[] = [
                'campus' => $campus->code,
                'activeStorefronts' => $this->suppress($activeSeller(SellerProfile::query()->where('campusId', $campus->id))->count()),
                'publishedListings' => $this->suppress($live($campus->id)->count()),
                'serviceListings' => $this->suppress($live($campus->id)->where('type', 'service')->count()),
                'pendingReview' => $this->suppress(Listing::query()->where('campusId', $campus->id)->where('status', 'pending_review')->whereNull('deletedAt')->count()),
                'inquiries' => $this->suppress(InquiryThread::query()->whereHas('listing', fn ($listing) => $listing->where('campusId', $campus->id))->count()),
            ];
        }

        return ApiResponse::json(['note' => 'Counts below 5 are suppressed. Inquiries are not completed sales.', 'campuses' => $out]);
    }

    private function suppress(int $value): int|string
    {
        return $value > 0 && $value < 5 ? '<5' : $value;
    }

    private function campusScope($query, $user)
    {
        $campuses = Permissions::reviewCampusIds($user);

        return $campuses === 'all' ? $query : $query->whereIn('campusId', $campuses);
    }

    /** A report is visible only when every target belongs to a permitted campus. */
    private function reportScope($query, $user)
    {
        $campuses = Permissions::reviewCampusIds($user);
        if ($campuses === 'all') {
            return $query;
        }

        return $query->where(fn ($target) => $target->whereNotNull('listingId')->orWhereNotNull('sellerProfileId'))
            ->where(fn ($target) => $target->whereNull('listingId')->orWhereHas('listing', fn ($listing) => $listing->whereIn('campusId', $campuses)))
            ->where(fn ($target) => $target->whereNull('sellerProfileId')->orWhereHas('seller', fn ($seller) => $seller->whereIn('campusId', $campuses)));
    }

    /** Runs inside the first approval transaction, so a failure rolls publication back. */
    private function notifyFollowers(Listing $listing): void
    {
        $followers = StoreFollow::query()->where('sellerProfileId', $listing->sellerProfileId)->where('userId', '!=', $listing->seller->ownerUserId)
            ->whereHas('user', fn ($user) => $user->where('status', 'active')->whereDoesntHave('roles', fn ($role) => $role->whereIn('role', self::STAFF_ROLES)))
            ->pluck('userId');
        $payload = [
            'storeId' => $listing->sellerProfileId,
            'storeName' => $listing->seller->storeName,
            'listingId' => $listing->id,
            'listingTitle' => $listing->title,
            'listingType' => $listing->type->value,
        ];
        foreach ($followers as $userId) {
            Notification::create(['userId' => $userId, 'type' => 'store.new_listing', 'payload' => $payload]);
        }
    }
}
