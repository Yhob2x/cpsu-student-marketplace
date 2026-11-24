<?php

namespace App\Enums;

enum VerificationStatus: string
{
    case unverified = 'unverified';
    case pending = 'pending';
    case verified = 'verified';
    case rejected = 'rejected';
    case suspended = 'suspended';
}
