<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingReview extends MarketplaceModel
{
    protected $table = 'ListingReview';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = null;
    protected $fillable = ['listingId', 'reviewerId', 'decision', 'reason', 'policyVersionId', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'listingId' => 'integer',
            'reviewerId' => 'integer',
            'decision' => \App\Enums\ReviewDecision::class,
            'policyVersionId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewerId', 'id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(CampusPolicy::class, 'policyVersionId', 'id');
    }
}
