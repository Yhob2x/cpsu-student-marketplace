<?php

namespace App\Enums;

enum TransactionStatus: string
{
    case pending = 'pending';
    case accepted = 'accepted';
    case negotiating = 'negotiating';
    case for_meetup = 'for_meetup';
    case completed = 'completed';
    case cancelled = 'cancelled';
}
