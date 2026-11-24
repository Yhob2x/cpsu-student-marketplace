<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Affiliation extends MarketplaceModel
{
    protected $table = 'Affiliation';
    protected $primaryKey = 'id';
    public $timestamps = false;
    protected $fillable = ['userId', 'campusId', 'verificationStatus', 'verifiedAt', 'expirationAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'userId' => 'integer',
            'campusId' => 'integer',
            'verificationStatus' => \App\Enums\VerificationStatus::class,
            'verifiedAt' => 'datetime',
            'expirationAt' => 'datetime',
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
