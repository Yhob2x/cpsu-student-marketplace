<?php

namespace App\Models;

use App\Enums\StoreReviewStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class StoreReview extends MarketplaceModel
{
    protected $table = 'StoreReview';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['transactionId', 'sellerProfileId', 'buyerUserId', 'rating', 'body', 'status', 'moderationReason', 'moderatedAt', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'transactionId' => 'integer',
            'sellerProfileId' => 'integer',
            'buyerUserId' => 'integer',
            'rating' => 'integer',
            'status' => StoreReviewStatus::class,
            'moderatedAt' => 'datetime',
            'createdAt' => 'datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transactionId', 'id');
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'sellerProfileId', 'id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyerUserId', 'id');
    }
}
