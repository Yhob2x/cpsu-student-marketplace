<?php

namespace App\Support;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/** Row visibility rules enforced in every query. Ported from row-access.ts and store-visibility.ts. */
final class ListingAccess
{
    public static function now(): string
    {
        return Carbon::now('UTC')->format('Y-m-d H:i:s.v');
    }

    public static function currentAffiliation(Builder $query): Builder
    {
        $now = self::now();

        return $query->where('verificationStatus', 'verified')
            ->where(fn ($expiry) => $expiry->whereNull('expirationAt')->orWhere('expirationAt', '>', $now));
    }

    public static function visibleStore(Builder $query): Builder
    {
        return $query->where('approvalStatus', 'approved')
            ->where('sellerType', 'student')
            ->whereHas('owner', fn ($owner) => $owner->where('status', 'active')
                ->whereDoesntHave('roles')
                ->whereHas('affiliations', fn ($affiliation) => self::currentAffiliation($affiliation)
                    ->whereHas('campus', fn ($campus) => $campus->where('active', true))));
    }

    public static function publicListing(Builder $query): Builder
    {
        return $query->where('status', 'published')
            ->whereNull('deletedAt')
            ->whereHas('seller', fn ($seller) => self::visibleStore($seller));
    }

    public static function availablePublicListing(Builder $query): Builder
    {
        return self::publicListing($query)->where('availabilityState', 'available');
    }

    /** Public, owner, or an authorized reviewer. Missing identity adds no private branch. */
    public static function visibleRows(Builder $query, ?AuthUser $actor): Builder
    {
        if ($actor === null) {
            return self::publicListing($query);
        }

        $campuses = Permissions::reviewCampusIds($actor);
        if ($campuses === 'all') {
            return $query;
        }

        return $query->where(function ($visible) use ($actor, $campuses) {
            $visible->where(fn ($public) => self::publicListing($public))
                ->orWhereHas('seller', fn ($seller) => $seller->where('ownerUserId', $actor->id));
            if ($campuses !== []) {
                $visible->orWhereIn('campusId', $campuses);
            }
        });
    }
}
