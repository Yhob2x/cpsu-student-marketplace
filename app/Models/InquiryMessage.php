<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class InquiryMessage extends MarketplaceModel
{
    protected $table = 'InquiryMessage';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['threadId', 'authorUserId', 'body', 'deliveredAt', 'seenAt', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'threadId' => 'integer',
            'authorUserId' => 'integer',
            'deliveredAt' => 'datetime',
            'seenAt' => 'datetime',
            'createdAt' => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(InquiryThread::class, 'threadId', 'id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'authorUserId', 'id');
    }
}
