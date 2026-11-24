<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class SellerProfile extends MarketplaceModel
{
    protected $table = 'SellerProfile';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = null;
    protected $fillable = ['ownerUserId', 'campusId', 'storeName', 'description', 'sellerType', 'approvalStatus', 'avatarPath', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'ownerUserId' => 'integer',
            'campusId' => 'integer',
            'sellerType' => \App\Enums\SellerType::class,
            'approvalStatus' => \App\Enums\ApprovalStatus::class,
            'createdAt' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ownerUserId', 'id');
    }

    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'sellerProfileId', 'id');
    }

    public function inquiryThreads(): HasMany
    {
        return $this->hasMany(InquiryThread::class, 'sellerProfileId', 'id');
    }

    public function storeFollows(): HasMany
    {
        return $this->hasMany(StoreFollow::class, 'sellerProfileId', 'id');
    }

    public function storeAppreciations(): HasMany
    {
        return $this->hasMany(StoreAppreciation::class, 'sellerProfileId', 'id');
    }

    public function storeReviews(): HasMany
    {
        return $this->hasMany(StoreReview::class, 'sellerProfileId', 'id');
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'campusId', 'id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'sellerProfileId', 'id');
    }
}
