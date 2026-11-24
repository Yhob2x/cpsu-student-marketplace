<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class InquiryPreference extends MarketplaceModel
{
    protected $table = 'InquiryPreference';
    protected $primaryKey = null;
    public $incrementing = false;
    public const COMPOSITE_KEY = ['threadId', 'userId'];
    public $timestamps = false;
    protected $fillable = ['threadId', 'userId', 'muted', 'hidden'];

    protected function casts(): array
    {
        return [
            'threadId' => 'integer',
            'userId' => 'integer',
            'muted' => 'boolean',
            'hidden' => 'boolean',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(InquiryThread::class, 'threadId', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
