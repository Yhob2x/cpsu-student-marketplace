<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingAppreciation extends MarketplaceModel
{
    protected $table = 'ListingAppreciation';
    protected $primaryKey = null;
    public $incrementing = false;
    public const COMPOSITE_KEY = ['userId', 'listingId'];
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = null;
    protected $fillable = ['userId', 'listingId', 'createdAt'];

    protected function casts(): array
    {
        return [
            'userId' => 'integer',
            'listingId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }
}
