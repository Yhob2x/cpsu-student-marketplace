<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\ListingMedia;
use App\Models\Notification;
use App\Models\SavedListing;
use App\Models\SellerProfile;
use App\Services\ListingRules;
use App\Services\MediaStorage;
use App\Services\PhotoService;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPayload;
use App\Support\ListingPresenter;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class SellerListingController extends Controller
{
    private const MAX_PHOTOS = 5;

    private const EDITABLE_MEDIA_STATES = ['draft', 'changes_requested', 'published'];

    public function __construct(
        private readonly MediaStorage $media,
        private readonly PhotoService $photos,
        private readonly ListingRules $rules,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $rows = Listing::query()->whereHas('seller', fn ($seller) => $seller->where('ownerUserId', $this->userId($request)))
            ->with(['media' => fn ($media) => $media->orderBy('id'), 'category'])
            ->orderByDesc('updatedAt')->get();
        $stocks = ListingPresenter::stocks($rows->pluck('id')->all());

        return ApiResponse::json($rows->map(fn ($row) => $row->toArray() + [
            'stockQuantity' => $stocks[$row->id]['stockQuantity'] ?? null,
            'reservedQuantity' => $stocks[$row->id]['reservedQuantity'] ?? null,
        ])->all(), 200, ['Cache-Control' => 'no-store']);
    }

    public function create(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        $parsed = ListingPayload::parse($body, false);
        $fields = $parsed['fields'];
        $stock = $parsed['stockQuantity'];
        $isProduct = $fields['type'] === 'physical_product';

        if (! $isProduct && (($fields['condition'] ?? null) !== null || $parsed['hasStock'])) {
            throw new ApiError(400, 'condition_not_applicable');
        }
        if ($isProduct && $parsed['hasStock'] && $stock === 0) {
            throw new ApiError(400, 'initial_stock_required');
        }
        $this->rejectAvailabilityFields($body);

        $store = SellerProfile::query()->where('ownerUserId', $this->userId($request))->where('approvalStatus', 'approved')->first();
        if ($store === null) {
            throw new ApiError(403, 'no_approved_store');
        }

        $listing = DB::transaction(function () use ($fields, $store, $isProduct, $stock) {
            $created = Listing::create($fields + ['sellerProfileId' => $store->id, 'campusId' => $store->campusId, 'status' => 'draft']);
            if ($isProduct) {
                ListingInventory::create(['listingId' => $created->id, 'availableQuantity' => $stock ?? 1]);
            }

            return $created->fresh();
        });

        return ApiResponse::json($listing->toArray() + ['stockQuantity' => $isProduct ? ($stock ?? 1) : null], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $listing = $this->ownListing($this->userId($request), ApiInput::routeInt($id));
        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if ($listing->availabilityState->value === 'sold') {
            throw new ApiError(409, 'sold_is_final');
        }
        if ($listing->reservationTransactionId !== null) {
            throw new ApiError(409, 'transaction_reservation_active');
        }
        $currentStatus = $listing->status->value;
        if (in_array($currentStatus, ['pending_review', 'suspended', 'rejected'], true)) {
            throw new ApiError(409, 'not_editable');
        }
        if ($request->attributes->get('apiBodyIsObject') === true) {
            $this->rejectAvailabilityFields($request->attributes->get('apiBody'));
        }

        $parsed = ListingPayload::parse(ApiInput::object($request), true);
        $patch = $parsed['fields'];
        $stockQuantity = $parsed['stockQuantity'];
        $type = $patch['type'] ?? $listing->type->value;
        if ($type === 'service' && (($patch['condition'] ?? null) !== null || $parsed['hasStock'])) {
            throw new ApiError(400, 'condition_not_applicable');
        }

        $inventoryReady = $type === 'physical_product' || $listing->type->value === 'physical_product';
        // Stock changes do not reset moderation. Changes to the listing itself do.
        $material = Permissions::isMaterialChange($patch, [
            'title' => $listing->title, 'description' => $listing->description, 'categoryId' => $listing->categoryId,
            'type' => $listing->type->value, 'campusId' => $listing->campusId, 'condition' => $listing->condition?->value,
        ]);
        $status = $currentStatus === 'published' && $material ? 'draft' : $currentStatus;

        $result = DB::transaction(function () use ($listing, $patch, $type, $stockQuantity, $inventoryReady, $status, $currentStatus) {
            $stock = $inventoryReady ? ListingInventory::query()->find($listing->id) : null;
            if ($stock?->reservedQuantity) {
                throw new ApiError(409, 'transaction_reservation_active');
            }

            if ($type === 'physical_product' && $inventoryReady) {
                $next = $stockQuantity ?? $stock?->availableQuantity ?? 1;
                if ($stock !== null) {
                    $changed = ListingInventory::query()->where('listingId', $listing->id)->where('reservedQuantity', 0)
                        ->where('availableQuantity', $stock->availableQuantity)->update(['availableQuantity' => $next]);
                    if ($changed !== 1) {
                        throw new ApiError(409, 'transaction_reservation_active');
                    }
                } else {
                    ListingInventory::create(['listingId' => $listing->id, 'availableQuantity' => $next]);
                }
            } elseif ($type === 'service' && $stock !== null) {
                ListingInventory::query()->where('listingId', $listing->id)->delete();
            }

            $quantity = $type === 'physical_product' ? ($stockQuantity ?? $stock?->availableQuantity ?? 1) : null;
            $setUnavailable = $currentStatus === 'published' && $type === 'physical_product' && $quantity === 0;
            $restocked = $currentStatus === 'published' && $type === 'physical_product' && $quantity !== null && $quantity > 0
                && $stock?->availableQuantity === 0 && $listing->availabilityState->value === 'reserved';

            $data = $patch + ['status' => $status];
            $data['status'] = $status;
            if ($type === 'service') {
                $data['condition'] = null;
            }
            if ($setUnavailable) {
                $data += ['availabilityState' => 'reserved', 'availability' => 'reserved'];
            }
            if ($restocked) {
                $data += ['availabilityState' => 'available', 'availability' => 'available'];
            }

            $changed = Listing::query()->whereKey($listing->id)->whereNull('reservationTransactionId')->whereNull('deletedAt')
                ->where('status', $currentStatus)->update($data);
            if ($changed === 0) {
                throw new ApiError(409, 'listing_changed');
            }

            return ['row' => Listing::query()->findOrFail($listing->id), 'quantity' => $quantity];
        });

        return ApiResponse::json($result['row']->toArray() + ['stockQuantity' => $result['quantity']]);
    }

    /** Authorizes and checks the photo limit before processing any uploaded bytes. */
    public function addMedia(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $listingId = ApiInput::routeInt($id);
        $this->assertCanAddPhoto($this->ownListing($userId, $listingId));

        $safe = $this->media->storeSanitized($this->photos->sanitize($this->listingFile($request)));
        try {
            $media = DB::transaction(function () use ($userId, $listingId, $safe) {
                $current = Listing::query()->whereKey($listingId)->whereHas('seller', fn ($seller) => $seller->where('ownerUserId', $userId))->with('media')->first();
                if ($current === null) {
                    throw new ApiError(404, 'not_found');
                }
                $this->assertCanAddPhoto($current);

                // A new photo on an approved listing always needs a fresh campus review.
                $requiresReview = $current->status->value === 'published';
                if ($requiresReview) {
                    Listing::query()->whereKey($current->id)->update(['status' => 'draft']);
                }

                $record = ListingMedia::create([
                    'listingId' => $current->id, 'mediaPath' => $safe['mediaPath'], 'mimeType' => $safe['mimeType'], 'position' => $current->media->count(),
                ]);
                AuditLog::create([
                    'actorUserId' => $userId, 'action' => 'listing.photo_added', 'targetType' => 'listing', 'targetId' => $current->id,
                    'metadata' => ['photoId' => $record->id, 'requiresReview' => $requiresReview],
                ]);

                return $record;
            });
        } catch (Throwable $error) {
            $this->media->deleteQuietly($safe['mediaPath']);
            throw $error;
        }

        return ApiResponse::json(['id' => $media->id], 201);
    }

    public function setCover(Request $request, string $id): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['mediaId']);
        $mediaId = ApiInput::integer($body, 'mediaId');
        if ($mediaId <= 0) {
            throw ApiInput::invalid('mediaId', 'Expected a positive integer', 'too_small');
        }

        $number = ApiInput::jsNumber($id);
        if ($number === null || ! is_finite($number) || floor($number) !== $number || $number <= 0 || $number > 2147483647) {
            throw new ApiError(404, 'not_found');
        }
        $listingId = (int) $number;
        $userId = $this->userId($request);

        DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        DB::transaction(function () use ($listingId, $mediaId, $userId) {
            $listing = Listing::query()->whereKey($listingId)->whereHas('seller', fn ($seller) => $seller->where('ownerUserId', $userId))
                ->with('media:id,listingId,position')->first(['id', 'status', 'deletedAt', 'reservationTransactionId']);
            if ($listing === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($listing->deletedAt !== null) {
                throw new ApiError(409, 'listing_deleted');
            }
            if ($listing->reservationTransactionId !== null) {
                throw new ApiError(409, 'transaction_reservation_active');
            }
            if (! in_array($listing->status->value, self::EDITABLE_MEDIA_STATES, true)) {
                throw new ApiError(409, 'not_editable');
            }

            $media = $listing->media->sortBy([['position', 'asc'], ['id', 'asc']])->values();
            $chosen = $media->firstWhere('id', $mediaId);
            if ($chosen === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($media->first()->id === $mediaId) {
                return;
            }

            $ordered = collect([$chosen])->concat($media->reject(fn ($photo) => $photo->id === $mediaId))->values();
            foreach ($ordered as $position => $photo) {
                if (ListingMedia::query()->whereKey($photo->id)->where('listingId', $listingId)->update(['position' => $position]) !== 1) {
                    throw new ApiError(409, 'listing_changed');
                }
            }
            AuditLog::create([
                'actorUserId' => $userId, 'action' => 'listing.cover_changed', 'targetType' => 'listing', 'targetId' => $listingId,
                'metadata' => ['coverMediaId' => $mediaId],
            ]);
        });

        return ApiResponse::json(['coverMediaId' => $mediaId]);
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $listing = $this->ownListing($userId, ApiInput::routeInt($id));
        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if (! in_array($listing->status->value, ['draft', 'changes_requested'], true)) {
            throw new ApiError(409, 'not_submittable');
        }
        if (! ListingAccess::currentAffiliation(Affiliation::query()->where('userId', $userId))->exists()) {
            throw new ApiError(403, 'affiliation_not_verified');
        }

        $flags = $this->rules->flags($listing, $listing->media->count());
        if (in_array('restricted_prohibited', $flags, true)) {
            throw new ApiError(422, 'category_prohibited', 'This category is not allowed on this campus.');
        }
        if (in_array('invalid_price', $flags, true) || in_array('missing_images', $flags, true)) {
            throw new ApiError(422, 'incomplete_listing', implode(',', $flags));
        }
        if ($listing->type->value === 'physical_product' && $listing->condition === null) {
            throw new ApiError(422, 'condition_required', 'Choose an item condition before submitting for review.');
        }
        if ($listing->availabilityState->value !== 'available') {
            throw new ApiError(409, 'listing_unavailable');
        }

        $updated = Listing::query()->findOrFail($listing->id);
        $updated->status = 'pending_review';
        $updated->flags = $flags;
        $updated->save();
        AuditLog::create(['actorUserId' => $userId, 'action' => 'listing.submit', 'targetType' => 'listing', 'targetId' => $listing->id, 'metadata' => ['flags' => $flags]]);

        return ApiResponse::json($updated->fresh()->toArray());
    }

    /** Sold is terminal. Moderation status does not change here. */
    public function availability(Request $request, string $id): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['availability']);
        $availability = ApiInput::enum($body, 'availability', ['available', 'reserved', 'sold']);
        $userId = $this->userId($request);
        $listing = $this->ownListing($userId, ApiInput::routeInt($id));
        $state = $listing->availabilityState->value;

        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if ($listing->status->value !== 'published') {
            throw new ApiError(409, 'not_published');
        }
        if ($state === 'sold' && $availability !== 'sold') {
            throw new ApiError(409, 'sold_is_final');
        }
        if ($listing->reservationTransactionId !== null && $availability !== $state) {
            throw new ApiError(409, 'transaction_reservation_active');
        }

        $stock = ListingPresenter::stocks([$listing->id])[$listing->id] ?? null;
        if (($stock['reservedQuantity'] ?? 0) > 0 && $availability !== $state) {
            throw new ApiError(409, 'transaction_reservation_active');
        }
        if ($listing->type->value === 'physical_product' && $stock !== null && $availability === 'available' && $stock['stockQuantity'] < 1) {
            throw new ApiError(409, 'out_of_stock');
        }
        if ($state === $availability) {
            return ApiResponse::json($listing->toArray());
        }

        $updated = DB::transaction(function () use ($listing, $availability, $stock, $state, $userId) {
            if ($availability === 'sold' && $stock !== null) {
                $changed = ListingInventory::query()->where('listingId', $listing->id)->where('reservedQuantity', 0)
                    ->where('availableQuantity', $stock['stockQuantity'])->update(['availableQuantity' => 0]);
                if ($changed === 0) {
                    throw new ApiError(409, 'transaction_reservation_active');
                }
            }

            $query = Listing::query()->whereKey($listing->id)->whereNull('deletedAt')->where('status', 'published')
                ->where('availabilityState', $state)->whereNull('reservationTransactionId');
            if ($stock !== null) {
                $query->whereHas('inventory', fn ($inventory) => $inventory->where('reservedQuantity', 0));
            }
            if ($query->update(['availabilityState' => $availability, 'availability' => $availability]) !== 1) {
                throw new ApiError(409, 'listing_changed');
            }
            AuditLog::create([
                'actorUserId' => $userId, 'action' => 'listing.availability_changed', 'targetType' => 'listing', 'targetId' => $listing->id,
                'metadata' => ['from' => $state, 'to' => $availability],
            ]);

            return Listing::query()->findOrFail($listing->id);
        });

        $saves = SavedListing::query()->where('listingId', $listing->id)->where('userId', '!=', $userId)->pluck('userId');
        if ($saves->isNotEmpty()) {
            $now = ListingAccess::now();
            $payload = json_encode(['listingId' => $listing->id, 'title' => $listing->title, 'availability' => $availability], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            Notification::query()->insert($saves->map(fn ($saver) => [
                'userId' => $saver, 'type' => 'listing.availability_changed', 'payload' => $payload, 'createdAt' => $now,
            ])->all());
        }

        return ApiResponse::json($updated->toArray());
    }

    /** Soft deletion keeps media, reports, reviews, audit records and conversations. */
    public function destroy(Request $request, string $id): Response
    {
        $userId = $this->userId($request);
        $listing = $this->ownListing($userId, ApiInput::routeInt($id));
        if ($listing->deletedAt !== null) {
            return response()->noContent();
        }
        if ($listing->reservationTransactionId !== null) {
            throw new ApiError(409, 'transaction_reservation_active');
        }
        if ((ListingPresenter::stocks([$listing->id])[$listing->id]['reservedQuantity'] ?? 0) > 0) {
            throw new ApiError(409, 'transaction_reservation_active');
        }

        DB::transaction(function () use ($listing, $userId) {
            $updated = Listing::query()->whereKey($listing->id)->whereNull('deletedAt')->whereNull('reservationTransactionId')
                ->update(['deletedAt' => ListingAccess::now()]);
            if ($updated !== 1) {
                throw new ApiError(409, 'listing_changed');
            }
            AuditLog::create([
                'actorUserId' => $userId, 'action' => 'listing.soft_deleted', 'targetType' => 'listing', 'targetId' => $listing->id,
                'metadata' => ['status' => $listing->status->value, 'availability' => $listing->availabilityState->value],
            ]);
        });

        return response()->noContent();
    }

    private function userId(Request $request): int
    {
        return $request->attributes->get('authUser')->id;
    }

    /** Another seller's listing is indistinguishable from one that does not exist. */
    private function ownListing(int $userId, int $id): Listing
    {
        $listing = Listing::query()->whereKey($id)->whereHas('seller', fn ($seller) => $seller->where('ownerUserId', $userId))
            ->with(['media' => fn ($media) => $media->orderBy('id')])->first();
        if ($listing === null) {
            throw new ApiError(404, 'not_found');
        }

        return $listing;
    }

    private function assertCanAddPhoto(Listing $listing): void
    {
        if ($listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_deleted');
        }
        if ($listing->reservationTransactionId !== null) {
            throw new ApiError(409, 'transaction_reservation_active');
        }
        if (! in_array($listing->status->value, self::EDITABLE_MEDIA_STATES, true)) {
            throw new ApiError(409, 'not_editable');
        }
        if ($listing->media->count() >= self::MAX_PHOTOS) {
            throw new ApiError(409, 'too_many_images', 'A listing can have up to '.self::MAX_PHOTOS.' photos.');
        }
    }

    private function rejectAvailabilityFields(array $body): void
    {
        foreach (['availability', 'availabilityState', 'deletedAt'] as $key) {
            if (array_key_exists($key, $body)) {
                throw new ApiError(400, 'invalid_availability_update');
            }
        }
    }

    private function listingFile(Request $request): UploadedFile
    {
        $files = $request->allFiles();
        $file = $files['image'] ?? null;
        if (count($files) > 1 || ($files !== [] && ! array_key_exists('image', $files)) || is_array($file)
            || ($file instanceof UploadedFile && (! $file->isValid() || $file->getSize() > 3145728))) {
            throw new ApiError(400, 'invalid_image', 'Upload one JPEG, PNG or WebP photo up to 3 MB.');
        }
        if (! $file instanceof UploadedFile || ! in_array($file->getClientMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiError(400, 'invalid_image', 'Upload a JPEG, PNG or WebP photo up to 3 MB.');
        }

        return $file;
    }
}
