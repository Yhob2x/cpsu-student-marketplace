<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Campus extends MarketplaceModel
{
    protected $table = 'Campus';

    protected $primaryKey = 'id';

    public $timestamps = false;

    protected $fillable = ['code', 'name', 'active'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function affiliations(): HasMany
    {
        return $this->hasMany(Affiliation::class, 'campusId', 'id');
    }

    public function listings(): HasMany
    {
        return $this->hasMany(Listing::class, 'campusId', 'id');
    }

    public function campusRoles(): HasMany
    {
        return $this->hasMany(UserRole::class, 'campusId', 'id');
    }

    public function campusPolicies(): HasMany
    {
        return $this->hasMany(CampusPolicy::class, 'campusId', 'id');
    }

    public function restrictedCategories(): HasMany
    {
        return $this->hasMany(RestrictedCategory::class, 'campusId', 'id');
    }

    public function sellerProfiles(): HasMany
    {
        return $this->hasMany(SellerProfile::class, 'campusId', 'id');
    }
}
