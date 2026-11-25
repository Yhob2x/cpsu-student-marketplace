<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class AuditLog extends MarketplaceModel
{
    protected $table = 'AuditLog';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['actorUserId', 'action', 'targetType', 'targetId', 'metadata', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'actorUserId' => 'integer',
            'targetId' => 'integer',
            'metadata' => 'array',
            'createdAt' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actorUserId', 'id');
    }
}
