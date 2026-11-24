<?php

namespace App\Models;

use App\Casts\PrismaDecimal;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Transaction extends MarketplaceModel
{
    protected $table = 'Transaction';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = 'updatedAt';
    protected $fillable = ['inquiryThreadId', 'activeThreadId', 'listingId', 'buyerUserId', 'sellerUserId', 'status', 'price', 'currency', 'buyerMeetupConfirmedAt', 'sellerMeetupConfirmedAt', 'buyerCompletionConfirmedAt', 'sellerCompletionConfirmedAt', 'createdAt', 'updatedAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'inquiryThreadId' => 'integer',
            'activeThreadId' => 'integer',
            'listingId' => 'integer',
            'buyerUserId' => 'integer',
            'sellerUserId' => 'integer',
            'status' => \App\Enums\TransactionStatus::class,
            'price' => PrismaDecimal::class,
            'buyerMeetupConfirmedAt' => 'datetime',
            'sellerMeetupConfirmedAt' => 'datetime',
            'buyerCompletionConfirmedAt' => 'datetime',
            'sellerCompletionConfirmedAt' => 'datetime',
            'createdAt' => 'datetime',
            'updatedAt' => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(InquiryThread::class, 'inquiryThreadId', 'id');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyerUserId', 'id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sellerUserId', 'id');
    }

    public function reservation(): HasOne
    {
        return $this->hasOne(Listing::class, 'reservationTransactionId', 'id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(TransactionStatusLog::class, 'transactionId', 'id');
    }

    public function storeReview(): HasOne
    {
        return $this->hasOne(StoreReview::class, 'transactionId', 'id');
    }
}
