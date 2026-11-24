<?php

namespace App\Models;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushDailyMetric extends MarketplaceModel
{
    protected $table = 'PushDailyMetric';
    protected $primaryKey = null;
    public $incrementing = false;
    public const COMPOSITE_KEY = ['dayKey', 'category', 'outcome'];
    public $timestamps = true;
    public const CREATED_AT = null;
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['dayKey', 'category', 'outcome', 'count', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'count' => 'integer',
            'updatedAt' => 'datetime',
        ];
    }
}
