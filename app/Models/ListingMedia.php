<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingMedia extends MarketplaceModel
{
    protected $table = 'ListingMedia';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $fillable = ['listingId', 'mediaPath', 'mimeType', 'position'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'listingId' => 'integer',
            'position' => 'integer',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }
}
