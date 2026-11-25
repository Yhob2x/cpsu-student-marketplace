<?php

namespace App\Support;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

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

    /**
     * The same eligibility rule as visibleStore(), as a set of store ids. Listing queries use
     * this so each store is evaluated once rather than once for every listing row.
     */
    public static function visibleStoreIds(?string $sellerType = null): QueryBuilder
    {
        $now = self::now();
        $stores = DB::table('SellerProfile as visible_store')
            ->select('visible_store.id')
            ->join('User as visible_owner', 'visible_owner.id', '=', 'visible_store.ownerUserId')
            ->where('visible_store.approvalStatus', 'approved')
            ->where('visible_store.sellerType', 'student')
            ->where('visible_owner.status', 'active')
            ->whereNotExists(fn ($role) => $role->selectRaw('1')->from('UserRole as visible_role')->whereColumn('visible_role.userId', 'visible_owner.id'))
            ->whereExists(fn ($affiliation) => $affiliation->selectRaw('1')
                ->from('Affiliation as visible_affiliation')
                ->join('Campus as visible_campus', 'visible_campus.id', '=', 'visible_affiliation.campusId')
                ->whereColumn('visible_affiliation.userId', 'visible_owner.id')
                ->where('visible_affiliation.verificationStatus', 'verified')
                ->where('visible_campus.active', true)
                ->where(fn ($expiry) => $expiry->whereNull('visible_affiliation.expirationAt')->orWhere('visible_affiliation.expirationAt', '>', $now)));

        return $sellerType === null ? $stores : $stores->where('visible_store.sellerType', $sellerType);
    }

    public static function publicListing(Builder $query): Builder
    {
        return $query->where('status', 'published')
            ->whereNull('deletedAt')
            ->whereIn('Listing.sellerProfileId', self::visibleStoreIds());
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
