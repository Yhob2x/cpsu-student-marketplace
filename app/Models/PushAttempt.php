<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushAttempt extends MarketplaceModel
{
    protected $table = 'PushAttempt';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['outboxId', 'endpointHash', 'state', 'attemptCount', 'lastStatus', 'nextAttemptAt', 'createdAt', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'outboxId' => 'integer',
            'attemptCount' => 'integer',
            'nextAttemptAt' => 'datetime',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function outbox(): BelongsTo
    {
        return $this->belongsTo(PushOutbox::class, 'outboxId', 'id');
    }
}
