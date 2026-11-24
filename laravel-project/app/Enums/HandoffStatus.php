<?php

namespace App\Enums;

enum HandoffStatus: string
{
    case proposed = 'proposed';
    case agreed = 'agreed';
    case completed = 'completed';
    case cancelled = 'cancelled';
    case not_confirmed = 'not_confirmed';
}
