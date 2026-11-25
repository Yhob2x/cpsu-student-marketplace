<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class PushOutbox extends MarketplaceModel
{
    protected $table = 'PushOutbox';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = 'updatedAt';

    protected $fillable = ['notificationId', 'userId', 'category', 'state', 'attemptCount', 'budgetReservedAt', 'nextAttemptAt', 'expiresAt', 'leaseToken', 'leasedUntil', 'lastStatus', 'sentAt', 'createdAt', 'updatedAt'];

    protected $hidden = ['leaseToken'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'notificationId' => 'integer',
            'userId' => 'integer',
            'attemptCount' => 'integer',
            'budgetReservedAt' => 'datetime',
            'nextAttemptAt' => 'datetime',
            'expiresAt' => 'datetime',
            'leasedUntil' => 'datetime',
            'sentAt' => 'datetime',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function notification(): BelongsTo
    {
        return $this->belongsTo(Notification::class, 'notificationId', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(PushAttempt::class, 'outboxId', 'id');
    }
}
