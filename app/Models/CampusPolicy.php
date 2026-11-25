<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class CampusPolicy extends MarketplaceModel
{
    protected $table = 'CampusPolicy';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $fillable = ['campusId', 'version', 'effectiveDate', 'approvedBy', 'documentRef'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'campusId' => 'integer',
            'version' => 'integer',
            'effectiveDate' => 'datetime',
        ];
    }

    public function restrictedCategories(): HasMany
    {
        return $this->hasMany(RestrictedCategory::class, 'policyVersionId', 'id');
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'campusId', 'id');
    }

    public function listingReviews(): HasMany
    {
        return $this->hasMany(ListingReview::class, 'policyVersionId', 'id');
    }
}
