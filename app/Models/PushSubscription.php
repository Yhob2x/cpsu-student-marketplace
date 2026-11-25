<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushSubscription extends MarketplaceModel
{
    protected $table = 'PushSubscription';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = 'updatedAt';

    protected $fillable = ['userId', 'endpointHash', 'endpoint', 'p256dh', 'auth', 'expiresAt', 'createdAt', 'updatedAt'];

    protected $hidden = ['endpoint', 'endpointHash', 'p256dh', 'auth'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'userId' => 'integer',
            'expiresAt' => 'datetime',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
