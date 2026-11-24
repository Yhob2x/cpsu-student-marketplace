<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class TransactionStatusLog extends MarketplaceModel
{
    protected $table = 'TransactionStatusLog';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['transactionId', 'actorUserId', 'fromStatus', 'toStatus', 'event', 'reason', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'transactionId' => 'integer',
            'actorUserId' => 'integer',
            'fromStatus' => TransactionStatus::class,
            'toStatus' => TransactionStatus::class,
            'createdAt' => 'datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transactionId', 'id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actorUserId', 'id');
    }
}
