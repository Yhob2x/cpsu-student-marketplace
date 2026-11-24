<?php

namespace App\Models;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Announcement extends MarketplaceModel
{
    protected $table = 'Announcement';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['title', 'body', 'pendingTitle', 'pendingBody', 'status', 'createdAt', 'updatedAt', 'publishedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'status' => \App\Enums\AnnouncementStatus::class,
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
            'publishedAt' => 'datetime',
        ];
    }
}
