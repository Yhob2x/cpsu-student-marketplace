<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Session extends MarketplaceModel
{
    protected $table = 'Session';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['userId', 'refreshTokenHash', 'device', 'expiresAt', 'revokedAt', 'createdAt'];

    protected $hidden = ['refreshTokenHash'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'userId' => 'integer',
            'expiresAt' => 'datetime',
            'revokedAt' => 'datetime',
            'createdAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
