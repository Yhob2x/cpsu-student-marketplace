<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class RestrictedCategory extends MarketplaceModel
{
    protected $table = 'RestrictedCategory';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = ['campusId', 'categoryId', 'policyAction', 'policyVersionId'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'campusId' => 'integer',
            'categoryId' => 'integer',
            'policyAction' => \App\Enums\PolicyAction::class,
            'policyVersionId' => 'integer',
        ];
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(CampusPolicy::class, 'policyVersionId', 'id');
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'campusId', 'id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'categoryId', 'id');
    }
}
