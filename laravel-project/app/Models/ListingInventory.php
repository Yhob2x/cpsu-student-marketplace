<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class ListingInventory extends MarketplaceModel
{
    protected $table = 'ListingInventory';
    protected $primaryKey = 'listingId';
    public $incrementing = false;
    public $timestamps = false;
    protected $fillable = ['listingId', 'availableQuantity', 'reservedQuantity'];

    protected function casts(): array
    {
        return [
            'listingId' => 'integer',
            'availableQuantity' => 'integer',
            'reservedQuantity' => 'integer',
        ];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }
}
