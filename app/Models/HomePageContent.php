<?php

namespace App\Models;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class HomePageContent extends MarketplaceModel
{
    protected $table = 'HomePageContent';

    protected $primaryKey = 'id';

    public $incrementing = false;

    public $timestamps = true;

    public const CREATED_AT = null;

    public const UPDATED_AT = 'updatedAt';

    protected $fillable = ['id', 'draft', 'published', 'revision', 'publishedRevision', 'updatedAt', 'publishedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'draft' => 'array',
            'published' => 'array',
            'revision' => 'integer',
            'publishedRevision' => 'integer',
            'updatedAt' => 'datetime',
            'publishedAt' => 'datetime',
        ];
    }
}
