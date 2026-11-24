<?php

namespace App\Models;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class GuidelineContent extends MarketplaceModel
{
    protected $table = 'GuidelineContent';
    protected $primaryKey = 'id';
    public $incrementing = false;
    public $timestamps = true;
    public const CREATED_AT = null;
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['id', 'draftBody', 'publishedBody', 'updatedAt', 'publishedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'updatedAt' => 'datetime',
            'publishedAt' => 'datetime',
        ];
    }
}
