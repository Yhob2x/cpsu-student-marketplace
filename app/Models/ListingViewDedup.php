<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingViewDedup extends MarketplaceModel
{
    protected $table = 'ListingViewDedup';

    protected $primaryKey = null;

    public $incrementing = false;

    public const COMPOSITE_KEY = ['listingId', 'viewerHash'];

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['listingId', 'viewerHash', 'createdAt'];

    protected function casts(): array
    {
        return [
            'listingId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }
}
