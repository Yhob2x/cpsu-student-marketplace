<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Report extends MarketplaceModel
{
    protected $table = 'Report';
    protected $primaryKey = 'id';
    public $timestamps = true;
    public const CREATED_AT = 'createdAt';
    public const UPDATED_AT = null;
    protected $fillable = ['reporterUserId', 'listingId', 'sellerProfileId', 'reason', 'status', 'assignedReviewerId', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'reporterUserId' => 'integer',
            'listingId' => 'integer',
            'sellerProfileId' => 'integer',
            'status' => \App\Enums\ReportStatus::class,
            'assignedReviewerId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporterUserId', 'id');
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(Listing::class, 'listingId', 'id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(SellerProfile::class, 'sellerProfileId', 'id');
    }

    public function assignedReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignedReviewerId', 'id');
    }
}
