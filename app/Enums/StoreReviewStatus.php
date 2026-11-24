<?php

namespace App\Enums;

enum StoreReviewStatus: string
{
    case pending = 'pending';
    case published = 'published';
    case rejected = 'rejected';
    case hidden = 'hidden';
}
