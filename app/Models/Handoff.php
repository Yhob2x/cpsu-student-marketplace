<?php

namespace App\Models;

use App\Enums\HandoffMethod;
use App\Enums\HandoffStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Generated from the approved Prisma schema. Table and column names must not change. */
class Handoff extends MarketplaceModel
{
    protected $table = 'Handoff';

    protected $primaryKey = 'id';

    public $timestamps = true;

    public const CREATED_AT = 'createdAt';

    public const UPDATED_AT = null;

    protected $fillable = ['inquiryThreadId', 'method', 'timeWindow', 'generalLocation', 'status', 'createdAt'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'inquiryThreadId' => 'integer',
            'method' => HandoffMethod::class,
            'status' => HandoffStatus::class,
            'createdAt' => 'datetime',
        ];
    }

    public function thread(): BelongsTo
    {
        return $this->belongsTo(InquiryThread::class, 'inquiryThreadId', 'id');
    }
}
