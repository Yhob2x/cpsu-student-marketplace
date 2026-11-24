<?php

namespace App\Enums;

enum PolicyAction: string
{
    case review = 'review';
    case prohibit = 'prohibit';
}
