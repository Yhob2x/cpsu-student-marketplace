<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class UserRole extends MarketplaceModel
{
    protected $table = 'UserRole';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = ['userId', 'role', 'campusId'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'userId' => 'integer',
            'role' => \App\Enums\Role::class,
            'campusId' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class, 'campusId', 'id');
    }
}
