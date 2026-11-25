<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Notification extends MarketplaceModel
{
    protected $table = 'Notification';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['userId', 'type', 'payload', 'readAt', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'userId' => 'integer',
            'payload' => 'array',
            'readAt' => 'datetime',
            'createdAt' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (self $notice) {
            $scope = str_starts_with($notice->type, 'transaction.') ? 'transaction' : 'account';
            \App\Services\Realtime::changed($notice->userId, $scope);
            try {
                app(\App\Services\PushDelivery::class)->enqueue($notice);
            } catch (\Throwable) {
                // In-app notification remains canonical; never retry a committed student action.
                \Illuminate\Support\Facades\Log::warning('Marketplace push enqueue unavailable.');
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function pushOutbox(): HasOne
    {
        return $this->hasOne(PushOutbox::class, 'notificationId', 'id');
    }
}
