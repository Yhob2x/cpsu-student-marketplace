<?php

namespace App\Models;

use App\Casts\PrismaDecimal;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Listing extends MarketplaceModel
{
    protected $table = 'Listing';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['sellerProfileId', 'campusId', 'categoryId', 'type', 'title', 'description', 'price', 'priceBasis', 'currency', 'availability', 'availabilityState', 'condition', 'deletedAt', 'reservationTransactionId', 'handoffNote', 'status', 'flags', 'createdAt', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'sellerProfileId' => 'integer',
            'campusId' => 'integer',
            'categoryId' => 'integer',
            'type' => \App\Enums\ListingType::class,
            'price' => PrismaDecimal::class,
            'availabilityState' => \App\Enums\AvailabilityState::class,
            'condition' => \App\Enums\ListingCondition::class,
            'deletedAt' => 'datetime',
            'reservationTransactionId' => 'integer',
            'status' => \App\Enums\ListingStatus::class,
            'flags' => 'array',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'sellerProfileId', 'id');
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'campusId', 'id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'categoryId', 'id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(ListingMedia::class, 'listingId', 'id');
    }

    public function threads(): HasMany
    {
        return $this->hasMany(InquiryThread::class, 'listingId', 'id');
    }

    public function savedListings(): HasMany
    {
        return $this->hasMany(SavedListing::class, 'listingId', 'id');
    }

    public function listingReviews(): HasMany
    {
        return $this->hasMany(ListingReview::class, 'listingId', 'id');
    }

    public function inventory(): HasOne
    {
        return $this->hasOne(ListingInventory::class, 'listingId', 'id');
    }

    public function appreciations(): HasMany
    {
        return $this->hasMany(ListingAppreciation::class, 'listingId', 'id');
    }

    public function viewCounter(): HasOne
    {
        return $this->hasOne(ListingViewCounter::class, 'listingId', 'id');
    }

    public function viewDedup(): HasMany
    {
        return $this->hasMany(ListingViewDedup::class, 'listingId', 'id');
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'listingId', 'id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'listingId', 'id');
    }

    public function reservedBy(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'reservationTransactionId', 'id');
    }
}
