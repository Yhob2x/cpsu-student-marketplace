<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushDailyBudget extends MarketplaceModel
{
    protected $table = 'PushDailyBudget';

    protected $primaryKey = null;

    public $incrementing = false;

    public const COMPOSITE_KEY = ['userId', 'dayKey'];

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = 'updatedAt';

    protected $fillable = ['userId', 'dayKey', 'count', 'createdAt', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'userId' => 'integer',
            'count' => 'integer',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
