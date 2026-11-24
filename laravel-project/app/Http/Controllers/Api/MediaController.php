<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ListingMedia;
use App\Models\SellerProfile;
use App\Services\MediaStorage;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ListingAccess;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    public function __construct(private readonly MediaStorage $media)
    {
    }

    /** A store photo is public only while the store and owner are active. */
    public function sellerAvatar(Request $request, string $id): Response
    {
        $seller = SellerProfile::query()->with('owner:id,status', 'owner.roles:id,userId', 'owner.affiliations.campus:id,active')->find(ApiInput::positiveId($id));
        if ($seller === null) {
            throw new ApiError(404, 'not_found');
        }

        $owner = $request->attributes->get('authUser')?->id === $seller->ownerUserId;
        $now = Carbon::now();
        $publiclyVisible = $seller->approvalStatus->value === 'approved' && $seller->sellerType->value === 'student'
            && $seller->owner->status->value === 'active' && $seller->owner->roles->isEmpty()
            && $seller->owner->affiliations->contains(fn ($affiliation) => $affiliation->verificationStatus->value === 'verified'
                && $affiliation->campus->active && ($affiliation->expirationAt === null || $affiliation->expirationAt->gt($now)));
        if ((! $publiclyVisible && ! $owner) || ! $seller->avatarPath) {
            throw new ApiError(404, 'not_found');
        }

        return $this->media->response($seller->avatarPath, 'image/webp');
    }

    public function listingMedia(Request $request, string $id): Response
    {
        $user = $request->attributes->get('authUser');
        $item = ListingMedia::query()->whereKey(ApiInput::routeInt($id))
            ->whereHas('listing', fn ($listing) => ListingAccess::visibleRows($listing, $user))
            ->with('listing.seller:id,ownerUserId,approvalStatus', 'listing.seller.owner:id,status')
            ->first();
        if ($item === null) {
            throw new ApiError(404, 'not_found');
        }

        $listing = $item->listing;
        $campuses = $user !== null ? Permissions::reviewCampusIds($user) : [];
        $public = $listing->status->value === 'published' && $listing->deletedAt === null
            && $listing->seller->approvalStatus->value === 'approved' && $listing->seller->owner->status->value === 'active';
        $allowed = $public || ($user !== null && $listing->seller->ownerUserId === $user->id)
            || $campuses === 'all' || in_array($listing->campusId, (array) $campuses, true);
        if (! $allowed) {
            throw new ApiError(404, 'not_found');
        }

        return $this->media->response($item->mediaPath, $item->mimeType);
    }
}
