<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class StoreFollow extends MarketplaceModel
{
    protected $table = 'StoreFollow';

    protected $primaryKey = null;

    public $incrementing = false;

    public const COMPOSITE_KEY = ['userId', 'sellerProfileId'];

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['userId', 'sellerProfileId', 'createdAt'];

    protected function casts(): array
    {
        return [
            'userId' => 'integer',
            'sellerProfileId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'sellerProfileId', 'id');
    }
}
