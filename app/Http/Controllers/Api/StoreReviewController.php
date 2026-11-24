<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\SellerProfile;
use App\Models\StoreReview;
use App\Models\Transaction;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\Permissions;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Ratings of completed transactions. Moderation is mandatory before publication. */
class StoreReviewController extends Controller
{
    /** No buyer names, email addresses, student IDs or transaction identifiers are returned. */
    public function publicReviews(Request $request, string $id): JsonResponse
    {
        $storeId = ApiInput::positiveId($id);
        $page = ApiQuery::int(ApiQuery::all($request), 'page', 1, 1, 10000);
        $pageSize = 8;
        if (! ListingAccess::visibleStore(SellerProfile::query()->whereKey($storeId))->exists()) {
            throw new ApiError(404, 'not_found');
        }

        $where = fn () => StoreReview::query()->where('sellerProfileId', $storeId)->where('status', 'published');
        $stats = $where()->toBase()->selectRaw('COUNT(*) AS total, AVG(rating) AS average')->first();
        $groups = $where()->toBase()->selectRaw('rating, COUNT(*) AS total')->groupBy('rating')->pluck('total', 'rating');
        $distribution = [];
        foreach (range(1, 5) as $rating) {
            $distribution[$rating] = (int) ($groups[$rating] ?? 0);
        }
        $items = $where()->orderByDesc('createdAt')->orderByDesc('id')->offset(($page - 1) * $pageSize)->limit($pageSize)->get(['id', 'rating', 'body', 'createdAt']);

        return ApiResponse::json([
            'available' => true,
            'summary' => [
                'count' => (int) $stats->total,
                'average' => $stats->average === null ? null : floor(((float) $stats->average) * 10 + 0.5) / 10,
                'distribution' => $distribution,
            ],
            'items' => $items->toArray(),
            'page' => $page,
            'pageSize' => $pageSize,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function opportunities(Request $request, string $id): JsonResponse
    {
        $storeId = ApiInput::positiveId($id);
        $page = ApiQuery::int(ApiQuery::all($request), 'page', 1, 1, 10000);
        $pageSize = 10;
        $userId = $request->attributes->get('authUser')->id;
        $store = ListingAccess::visibleStore(SellerProfile::query()->whereKey($storeId))->first(['id', 'ownerUserId']);
        if ($store === null) {
            throw new ApiError(404, 'store_not_available');
        }

        $headers = ['Cache-Control' => 'private, no-store'];
        $empty = fn (string $reason) => ApiResponse::json(['available' => true, 'items' => [], 'page' => $page, 'pageSize' => $pageSize, 'hasMore' => false, 'reason' => $reason], 200, $headers);
        if ($store->ownerUserId === $userId) {
            return $empty('cannot_review_own_store');
        }
        if (! $this->verified($userId)) {
            return $empty('verified_student_required');
        }

        $rows = Transaction::query()->where('buyerUserId', $userId)->where('sellerUserId', $store->ownerUserId)->where('status', 'completed')
            ->whereHas('listing', fn ($listing) => $listing->where('sellerProfileId', $storeId))
            ->whereDoesntHave('storeReview')
            ->with('listing:id,title')
            ->orderByDesc('createdAt')->orderByDesc('id')->offset(($page - 1) * $pageSize)->limit($pageSize + 1)
            ->get(['id', 'listingId', 'createdAt']);

        return ApiResponse::json([
            'available' => true,
            'items' => $rows->take($pageSize)->map(fn ($row) => ['id' => $row->id, 'createdAt' => ApiResponse::date($row->createdAt), 'listing' => ['title' => $row->listing->title]])->values()->all(),
            'page' => $page,
            'pageSize' => $pageSize,
            'hasMore' => $rows->count() > $pageSize,
            'reason' => $rows->isNotEmpty() ? null : 'no_eligible_completed_transaction',
        ], 200, $headers);
    }

    /** Only the purchasing student may inspect review eligibility or state. */
    public function forTransaction(Request $request, string $id): JsonResponse
    {
        $transactionId = ApiInput::positiveId($id);
        $userId = $request->attributes->get('authUser')->id;
        $transaction = Transaction::query()->whereKey($transactionId)->where('buyerUserId', $userId)->with('listing:id,sellerProfileId')->first(['id', 'status', 'sellerUserId', 'listingId']);
        if ($transaction === null) {
            throw new ApiError(404, 'not_found');
        }

        $review = StoreReview::query()->where('transactionId', $transactionId)->where('buyerUserId', $userId)->first(['id', 'rating', 'body', 'status', 'createdAt', 'moderationReason']);
        $completed = $transaction->status->value === 'completed';
        $couldReview = $completed && $transaction->sellerUserId !== $userId && $review === null;
        $affiliation = $couldReview && $this->verified($userId);
        $store = $affiliation && ListingAccess::visibleStore(SellerProfile::query()->whereKey($transaction->listing->sellerProfileId)->where('ownerUserId', $transaction->sellerUserId))->exists();
        $reason = match (true) {
            $review !== null => 'already_reviewed',
            ! $completed => 'transaction_not_completed',
            $transaction->sellerUserId === $userId => 'cannot_review_own_store',
            ! $affiliation => 'verified_student_required',
            ! $store => 'store_not_available',
            default => null,
        };

        return ApiResponse::json(['available' => true, 'eligible' => $couldReview && $affiliation && $store, 'reason' => $reason, 'review' => $review?->toArray()], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $transactionId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['rating', 'body']);
        $rating = ApiInput::integer($body, 'rating');
        if ($rating < 1 || $rating > 5) {
            throw ApiInput::invalid('rating', 'Invalid rating');
        }
        $text = array_key_exists('body', $body) && $body['body'] !== null ? ApiInput::string($body, 'body', null, 800, true) : null;
        $userId = $request->attributes->get('authUser')->id;

        if (! $this->verified($userId)) {
            throw new ApiError(403, 'verified_student_required');
        }
        $transaction = Transaction::query()->whereKey($transactionId)->where('buyerUserId', $userId)->where('status', 'completed')->with('listing:id,sellerProfileId')->first(['id', 'sellerUserId', 'listingId']);
        if ($transaction === null) {
            throw new ApiError(404, 'completed_transaction_required');
        }
        if ($transaction->sellerUserId === $userId) {
            throw new ApiError(403, 'cannot_review_own_store');
        }
        $store = ListingAccess::visibleStore(SellerProfile::query()->whereKey($transaction->listing->sellerProfileId))->first(['id', 'ownerUserId']);
        if ($store === null || $store->ownerUserId !== $transaction->sellerUserId || $store->ownerUserId === $userId) {
            throw new ApiError(404, 'store_not_available');
        }

        try {
            $saved = DB::transaction(function () use ($transactionId, $userId, $transaction, $store, $rating, $text) {
                $current = Transaction::query()->whereKey($transactionId)->where('buyerUserId', $userId)->where('sellerUserId', $transaction->sellerUserId)->where('status', 'completed')
                    ->with('listing:id,sellerProfileId')->first(['id', 'listingId']);
                if ($current === null || $current->listing->sellerProfileId !== $store->id) {
                    throw new ApiError(409, 'transaction_changed');
                }

                $created = StoreReview::create([
                    'transactionId' => $transactionId, 'sellerProfileId' => $store->id, 'buyerUserId' => $userId,
                    'rating' => $rating, 'body' => $text === '' ? null : $text, 'status' => 'pending',
                ]);
                AuditLog::create(['actorUserId' => $userId, 'action' => 'store_review.submit', 'targetType' => 'store_review', 'targetId' => $created->id]);

                return StoreReview::query()->whereKey($created->id)->first(['id', 'rating', 'status', 'createdAt']);
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiError(409, 'already_reviewed');
        }

        return ApiResponse::json(['review' => $saved->toArray(), 'message' => 'Review submitted for campus moderation.'], 201, ['Cache-Control' => 'private, no-store']);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        $status = ApiQuery::enum($input, 'status', ['pending', 'published'], 'pending');
        $page = ApiQuery::int($input, 'page', 1, 1, 10000);
        $items = $this->scoped($request)->where('status', $status)
            ->with('store:id,storeName,campusId', 'transaction:id,listingId', 'transaction.listing:id,title')
            ->orderByDesc('createdAt')->orderByDesc('id')->offset(($page - 1) * 20)->limit(21)
            ->get(['id', 'rating', 'body', 'status', 'createdAt', 'sellerProfileId', 'transactionId']);

        return ApiResponse::json([
            'available' => true,
            'items' => $items->take(20)->map(fn ($row) => [
                'id' => $row->id, 'rating' => $row->rating, 'body' => $row->body, 'status' => $row->status->value,
                'createdAt' => ApiResponse::date($row->createdAt),
                'store' => ['storeName' => $row->store->storeName, 'campusId' => $row->store->campusId],
                'transaction' => ['listing' => ['title' => $row->transaction->listing->title]],
            ])->values()->all(),
            'page' => $page,
            'pageSize' => 20,
            'hasMore' => $items->count() > 20,
        ], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function adminDecision(Request $request, string $id): JsonResponse
    {
        $reviewId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['decision', 'reason']);
        $decision = ApiInput::enum($body, 'decision', ['published', 'rejected', 'hidden']);
        $reason = ApiInput::string($body, 'reason', 10, 500, true);
        $actor = $request->attributes->get('authUser')->id;

        DB::transaction(function () use ($request, $reviewId, $decision, $reason, $actor) {
            $review = $this->scoped($request)->whereKey($reviewId)->first(['id', 'status']);
            if ($review === null) {
                throw new ApiError(404, 'not_found');
            }
            $status = $review->status->value;
            if (($decision === 'hidden' && $status !== 'published') || ($decision !== 'hidden' && $status !== 'pending')) {
                throw new ApiError(409, 'invalid_review_state');
            }

            $updated = $this->scoped($request)->whereKey($reviewId)->where('status', $status)
                ->update(['status' => $decision, 'moderationReason' => $reason, 'moderatedAt' => ListingAccess::now()]);
            if ($updated !== 1) {
                throw new ApiError(409, 'review_changed');
            }
            AuditLog::create(['actorUserId' => $actor, 'action' => "store_review.{$decision}", 'targetType' => 'store_review', 'targetId' => $reviewId, 'metadata' => ['reason' => $reason]]);
        });

        return ApiResponse::json(['ok' => true], 200, ['Cache-Control' => 'private, no-store']);
    }

    private function scoped(Request $request)
    {
        $campuses = Permissions::reviewCampusIds($request->attributes->get('authUser'));
        $query = StoreReview::query();

        return $campuses === 'all' ? $query : $query->whereHas('store', fn ($store) => $store->whereIn('campusId', $campuses));
    }

    private function verified(int $userId): bool
    {
        return ListingAccess::currentAffiliation(Affiliation::query()->where('userId', $userId))
            ->whereHas('campus', fn ($campus) => $campus->where('active', true))->exists();
    }
}
