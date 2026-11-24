<?php

namespace App\Enums;

enum ListingStatus: string
{
    case draft = 'draft';
    case pending_review = 'pending_review';
    case changes_requested = 'changes_requested';
    case published = 'published';
    case rejected = 'rejected';
    case suspended = 'suspended';
}
