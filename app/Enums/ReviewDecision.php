<?php

namespace App\Enums;

enum ReviewDecision: string
{
    case approved = 'approved';
    case changes_requested = 'changes_requested';
    case rejected = 'rejected';
}
