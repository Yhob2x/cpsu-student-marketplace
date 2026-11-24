<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushPreference extends MarketplaceModel
{
    protected $table = 'PushPreference';
    protected $primaryKey = 'userId';
    public $incrementing = false;
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['userId', 'messages', 'listingReviews', 'accountUpdates', 'masterEnabled', 'quietStartMinute', 'quietEndMinute', 'createdAt', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'userId' => 'integer',
            'messages' => 'boolean',
            'listingReviews' => 'boolean',
            'accountUpdates' => 'boolean',
            'masterEnabled' => 'boolean',
            'quietStartMinute' => 'integer',
            'quietEndMinute' => 'integer',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
