<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class StudentIdentity extends MarketplaceModel
{
    protected $table = 'StudentIdentity';

    protected $primaryKey = 'userId';

    public $incrementing = false;

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['userId', 'fullName', 'studentIdNumber', 'createdAt'];

    protected $hidden = ['fullName', 'studentIdNumber'];

    protected function casts(): array
    {
        return [
            'userId' => 'integer',
            'createdAt' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
