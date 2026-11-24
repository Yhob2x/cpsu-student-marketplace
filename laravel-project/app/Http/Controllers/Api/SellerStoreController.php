<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Listing;
use App\Models\SellerProfile;
use App\Services\MediaStorage;
use App\Services\PhotoService;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ListingPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class SellerStoreController extends Controller
{
    private const AVATAR_ERROR = 'Select one JPEG, PNG or WebP image up to 3 MB.';

    public function __construct(
        private readonly MediaStorage $media,
        private readonly PhotoService $photos,
    ) {
    }

    public function create(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        $storeName = ApiInput::string($body, 'storeName', 2, 80, true);
        $description = ApiInput::string($body, 'description', 10, 1000, true);
        $userId = $request->attributes->get('authUser')->id;

        $affiliation = ListingAccess::currentAffiliation(Affiliation::query()->where('userId', $userId))->first();
        if ($affiliation === null) {
            throw new ApiError(403, 'affiliation_not_verified');
        }
        if (SellerProfile::query()->where('ownerUserId', $userId)->exists()) {
            throw new ApiError(409, 'store_exists');
        }

        $store = SellerProfile::create([
            'storeName' => $storeName, 'description' => $description, 'ownerUserId' => $userId,
            'campusId' => $affiliation->campusId, 'sellerType' => 'student', 'approvalStatus' => 'approved',
        ]);

        return ApiResponse::json($store->fresh()->toArray(), 201);
    }

    public function show(Request $request): JsonResponse
    {
        $store = SellerProfile::query()->where('ownerUserId', $request->attributes->get('authUser')->id)
            ->first(['id', 'storeName', 'description', 'campusId', 'approvalStatus', 'avatarPath']);
        $headers = ['Cache-Control' => 'private, no-store'];
        if ($store === null) {
            return ApiResponse::json(null, 200, $headers);
        }

        $published = Listing::query()->where('sellerProfileId', $store->id)->where('status', 'published')->whereNull('deletedAt')->count();
        $activity = ListingPresenter::activityBadge($published, ListingPresenter::followSummary($store->id)['count']);

        return ApiResponse::json([
            'id' => $store->id,
            'storeName' => $store->storeName,
            'description' => $store->description,
            'campusId' => $store->campusId,
            'approvalStatus' => $store->approvalStatus->value,
            'avatarUrl' => ListingPresenter::avatarUrl($store->id, $store->avatarPath),
            'badge' => $activity['label'],
            'badgeReason' => $activity['reason'],
        ], 200, $headers);
    }

    public function update(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['storeName', 'description']);
        $change = [
            'storeName' => ApiInput::string($body, 'storeName', 2, 80, true),
            'description' => ApiInput::string($body, 'description', 10, 1000, true),
        ];
        $userId = $request->attributes->get('authUser')->id;

        $store = SellerProfile::query()->where('ownerUserId', $userId)->where('approvalStatus', 'approved')->first(['id']);
        if ($store === null) {
            throw new ApiError(404, 'not_found');
        }

        $updated = DB::transaction(function () use ($store, $change, $userId) {
            SellerProfile::query()->whereKey($store->id)->update($change);
            AuditLog::create(['actorUserId' => $userId, 'action' => 'seller.store_updated', 'targetType' => 'seller_profile', 'targetId' => $store->id]);

            return SellerProfile::query()->whereKey($store->id)->first(['id', 'storeName', 'description']);
        });

        return ApiResponse::json($updated->toArray(), 200, ['Cache-Control' => 'private, no-store']);
    }

    /** A photo publishes only after sanitization and a successful local safety screen. */
    public function uploadAvatar(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('authUser')->id;
        if (! SellerProfile::query()->where('ownerUserId', $userId)->where('approvalStatus', 'approved')->exists()) {
            throw new ApiError(403, 'no_approved_store');
        }

        $sanitized = $this->photos->sanitize($this->avatarFile($request), true);
        $stored = null;
        try {
            $this->photos->screenAvatar($sanitized['mediaPath']);
            $stored = $this->media->storeSanitized($sanitized);
            $published = $this->publishAvatar($userId, $stored['mediaPath']);
            if ($published['previousPath'] && $published['previousPath'] !== $stored['mediaPath']) {
                $this->media->deleteQuietly($published['previousPath']);
            }

            return ApiResponse::json(['avatarUrl' => ListingPresenter::avatarUrl($published['id'], $stored['mediaPath'])], 200, ['Cache-Control' => 'private, no-store']);
        } catch (Throwable $error) {
            $this->media->deleteQuietly($stored['mediaPath'] ?? $sanitized['mediaPath']);
            throw $error;
        }
    }

    public function removeAvatar(Request $request): Response
    {
        $userId = $request->attributes->get('authUser')->id;
        $old = DB::transaction(function () use ($userId) {
            $store = SellerProfile::query()->where('ownerUserId', $userId)->first(['id', 'avatarPath']);
            if ($store === null) {
                throw new ApiError(404, 'not_found');
            }
            if (! $store->avatarPath) {
                return null;
            }

            $changed = SellerProfile::query()->whereKey($store->id)->where('avatarPath', $store->avatarPath)->update(['avatarPath' => null]);
            if ($changed !== 1) {
                throw new ApiError(409, 'avatar_changed');
            }
            AuditLog::create(['actorUserId' => $userId, 'action' => 'seller.avatar_removed', 'targetType' => 'seller_profile', 'targetId' => $store->id]);

            return $store->avatarPath;
        });

        if ($old) {
            $this->media->deleteQuietly($old);
        }

        return response()->noContent();
    }

    private function avatarFile(Request $request): UploadedFile
    {
        $files = $request->allFiles();
        $file = $files['image'] ?? null;
        if (count($files) !== 1 || ! $file instanceof UploadedFile || ! $file->isValid() || $file->getSize() > 3145728
            || ! in_array($file->getClientMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiError(400, 'invalid_image', self::AVATAR_ERROR);
        }

        return $file;
    }

    /** The conditional write stops a slower upload overwriting a newer choice. */
    private function publishAvatar(int $userId, string $mediaPath): array
    {
        return DB::transaction(function () use ($userId, $mediaPath) {
            $store = SellerProfile::query()->where('ownerUserId', $userId)->where('approvalStatus', 'approved')->first(['id', 'avatarPath']);
            if ($store === null) {
                throw new ApiError(403, 'no_approved_store');
            }

            $query = SellerProfile::query()->whereKey($store->id)->where('ownerUserId', $userId)->where('approvalStatus', 'approved');
            $store->avatarPath === null ? $query->whereNull('avatarPath') : $query->where('avatarPath', $store->avatarPath);
            if ($query->update(['avatarPath' => $mediaPath]) !== 1) {
                throw new ApiError(409, 'avatar_changed', 'Your store photo changed during upload. Refresh the page and try again.');
            }
            AuditLog::create(['actorUserId' => $userId, 'action' => 'seller.avatar_published', 'targetType' => 'seller_profile', 'targetId' => $store->id]);

            return ['id' => $store->id, 'previousPath' => $store->avatarPath];
        });
    }
}
