<?php

namespace App\Models;

use App\Enums\InquiryStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class InquiryThread extends MarketplaceModel
{
    protected $table = 'InquiryThread';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['listingId', 'buyerUserId', 'sellerProfileId', 'status', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'listingId' => 'integer',
            'buyerUserId' => 'integer',
            'sellerProfileId' => 'integer',
            'status' => InquiryStatus::class,
            'createdAt' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'sellerProfileId', 'id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(InquiryMessage::class, 'threadId', 'id');
    }

    public function preferences(): HasMany
    {
        return $this->hasMany(InquiryPreference::class, 'threadId', 'id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyerUserId', 'id');
    }

    public function handoff(): HasOne
    {
        return $this->hasOne(Handoff::class, 'inquiryThreadId', 'id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'inquiryThreadId', 'id');
    }
}
