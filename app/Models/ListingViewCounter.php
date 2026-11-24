<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingViewCounter extends MarketplaceModel
{
    protected $table = 'ListingViewCounter';
    protected $primaryKey = 'listingId';
    public $incrementing = false;
    public $timestamps = false;
    protected $fillable = ['listingId', 'viewCount'];

    protected function casts(): array
    {
        return [
            'listingId' => 'integer',
            'viewCount' => 'integer',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }
}
