<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Category extends MarketplaceModel
{
    protected $table = 'Category';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = ['parentId', 'name', 'listingType', 'policyRiskLevel'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'parentId' => 'integer',
            'listingType' => \App\Enums\ListingType::class,
            'policyRiskLevel' => 'integer',
        ];
    }

    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'categoryId', 'id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parentId', 'id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parentId', 'id');
    }

    public function restrictedCategories(): HasMany
    {
        return $this->hasMany(RestrictedCategory::class, 'categoryId', 'id');
    }
}
