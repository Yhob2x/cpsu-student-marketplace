<?php

namespace App\Support;

use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\StoreFollow;
use App\Models\StoreReview;
use Illuminate\Support\Facades\DB;

/** Public JSON shapes shared by listing and storefront endpoints. */
final class ListingPresenter
{
    public const RELATIONS = [
        'category:id,name',
        'campus:id,code,name',
        'seller:id,ownerUserId,storeName,sellerType,avatarPath,approvalStatus',
        'seller.owner:id,status',
        'media:id,listingId,position',
    ];

    public static function present(Listing $listing, ?array $ratings, array $stocks): array
    {
        $seller = $listing->seller;
        $media = $listing->media->sortBy([['position', 'asc'], ['id', 'asc']])->values();

        return [
            'id' => $listing->id,
            'type' => $listing->type->value,
            'title' => $listing->title,
            'description' => $listing->description,
            'price' => (float) $listing->price,
            'priceBasis' => $listing->priceBasis,
            'currency' => $listing->currency,
            'availability' => $listing->availabilityState->value,
            'condition' => $listing->condition?->value,
            'stockQuantity' => $listing->type->value === 'physical_product' ? ($stocks[$listing->id]['stockQuantity'] ?? null) : null,
            'handoffNote' => $listing->handoffNote,
            'createdAt' => ApiResponse::date($listing->createdAt),
            'category' => $listing->category ? ['id' => $listing->category->id, 'name' => $listing->category->name] : null,
            'campus' => $listing->campus ? ['id' => $listing->campus->id, 'code' => $listing->campus->code, 'name' => $listing->campus->name] : null,
            'seller' => $seller ? [
                'id' => $seller->id,
                'storeName' => $seller->storeName,
                'sellerType' => $seller->sellerType->value,
                'avatarUrl' => self::avatarUrl($seller->id, $seller->avatarPath),
            ] + ($ratings !== null ? ['rating' => $ratings[$seller->id] ?? null] : []) : null,
            'images' => $media->map(fn ($item) => "/api/v1/media/{$item->id}")->all(),
        ];
    }

    public static function avatarUrl(int $storeId, ?string $mediaPath): ?string
    {
        if ($mediaPath === null || $mediaPath === '') {
            return null;
        }

        return "/api/v1/media/seller-avatar/{$storeId}?v=".substr(hash('sha256', $mediaPath), 0, 16);
    }

    /** @return array<int, array{stockQuantity:int, reservedQuantity:int}> */
    public static function stocks(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        return ListingInventory::query()->whereIn('listingId', array_values(array_unique($ids)))->get()
            ->mapWithKeys(fn ($row) => [$row->listingId => ['stockQuantity' => $row->availableQuantity, 'reservedQuantity' => $row->reservedQuantity]])
            ->all();
    }

    /** @return array<int, array{count:int, average:float}> */
    public static function ratings(array $sellerIds): array
    {
        $ids = array_values(array_unique(array_filter($sellerIds, fn ($id) => $id > 0)));
        if ($ids === []) {
            return [];
        }

        $ratings = [];
        $groups = StoreReview::query()->toBase()->selectRaw('sellerProfileId, AVG(rating) AS average, COUNT(*) AS total')
            ->whereIn('sellerProfileId', $ids)->where('status', 'published')->groupBy('sellerProfileId')->get();
        foreach ($groups as $group) {
            $ratings[(int) $group->sellerProfileId] = [
                'count' => (int) $group->total,
                'average' => floor(((float) $group->average) * 10 + 0.5) / 10,
            ];
        }

        return $ratings;
    }

    public static function followSummary(int $storeId, ?int $viewerId = null): array
    {
        return [
            'count' => StoreFollow::query()->where('sellerProfileId', $storeId)->count(),
            'isFollowing' => $viewerId !== null && StoreFollow::query()->where('sellerProfileId', $storeId)->where('userId', $viewerId)->exists(),
            'available' => true,
        ];
    }

    public static function activityBadge(int $publishedListings, int $followers): array
    {
        $listings = max(0, $publishedListings);
        $followers = max(0, $followers);
        $listingText = "{$listings} published ".($listings === 1 ? 'listing' : 'listings');
        $followerText = ", {$followers} ".($followers === 1 ? 'follower' : 'followers');
        $reason = "Based on {$listingText}{$followerText}. This is an activity label, not a verification or safety guarantee.";

        $label = match (true) {
            $listings > 0 && $followers >= 20 => 'Popular store',
            $listings >= 5 => 'Frequent seller',
            $listings >= 1 => 'Active seller',
            default => 'New store',
        };

        return ['label' => $label, 'reason' => $reason];
    }

    /** Hydrates a ranked id list without changing its order. */
    public static function ranked(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $rows = ListingAccess::availablePublicListing(Listing::query())->whereIn('id', $ids)->with(self::RELATIONS)->get()->keyBy('id');
        $ratings = self::ratings($rows->pluck('sellerProfileId')->all());
        $stocks = self::stocks($rows->keys()->all());
        $items = [];
        foreach ($ids as $id) {
            if ($rows->has($id)) {
                $items[] = self::present($rows[$id], $ratings, $stocks);
            }
        }

        return $items;
    }

    public static function freshIds(): array
    {
        return array_map(fn ($row) => (int) $row->id, DB::select("
            SELECT l.id
            FROM `Listing` AS l
            JOIN `SellerProfile` AS s ON s.id = l.sellerProfileId
            JOIN `User` AS u ON u.id = s.ownerUserId
            LEFT JOIN (
              SELECT listingId, MAX(createdAt) AS approvedAt
              FROM `ListingReview`
              WHERE decision = 'approved'
              GROUP BY listingId
            ) AS reviews ON reviews.listingId = l.id
            WHERE l.status = 'published' AND l.availabilityState = 'available'
              AND l.deletedAt IS NULL AND s.approvalStatus = 'approved'
              AND u.status = 'active'
            ORDER BY COALESCE(reviews.approvedAt, l.createdAt) DESC, l.id DESC
            LIMIT 24
        "));
    }

    /** Ranks real appreciations and views across the database before applying the limit. */
    public static function popularIds(): array
    {
        return array_map(fn ($row) => (int) $row->id, DB::select("
            SELECT l.id
            FROM `Listing` AS l
            JOIN `SellerProfile` AS s ON s.id = l.sellerProfileId
            JOIN `User` AS owner ON owner.id = s.ownerUserId
            LEFT JOIN (
              SELECT listingId, COUNT(*) AS total
              FROM `ListingAppreciation`
              GROUP BY listingId
            ) AS likes ON likes.listingId = l.id
            LEFT JOIN `ListingViewCounter` AS views ON views.listingId = l.id
            WHERE l.status = 'published'
              AND l.availabilityState = 'available'
              AND l.deletedAt IS NULL
              AND s.approvalStatus = 'approved'
              AND s.sellerType = 'student'
              AND owner.status = 'active'
              AND NOT EXISTS (SELECT 1 FROM `UserRole` AS role WHERE role.userId = owner.id)
              AND EXISTS (
                SELECT 1
                FROM `Affiliation` AS affiliation
                JOIN `Campus` AS campus ON campus.id = affiliation.campusId
                WHERE affiliation.userId = owner.id
                  AND affiliation.verificationStatus = 'verified'
                  AND campus.active = 1
                  AND (affiliation.expirationAt IS NULL OR affiliation.expirationAt > UTC_TIMESTAMP())
              )
              AND (COALESCE(likes.total, 0) + COALESCE(views.viewCount, 0)) > 0
            ORDER BY
              ((4 * COALESCE(likes.total, 0) + LOG2(1 + COALESCE(views.viewCount, 0))) /
                (1 + GREATEST(0, TIMESTAMPDIFF(HOUR, l.createdAt, UTC_TIMESTAMP())) / 720.0)) DESC,
              COALESCE(likes.total, 0) DESC, COALESCE(views.viewCount, 0) DESC, l.createdAt DESC, l.id DESC
            LIMIT 8
        "));
    }
}
