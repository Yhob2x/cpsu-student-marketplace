<?php

namespace App\Enums;

enum ApprovalStatus: string
{
    case pending = 'pending';
    case approved = 'approved';
    case rejected = 'rejected';
    case suspended = 'suspended';
}
