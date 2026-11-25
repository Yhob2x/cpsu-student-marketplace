<?php

namespace App\Enums;

enum ListingCondition: string
{
    case new = 'new';
    case like_new = 'like_new';
    case good = 'good';
    case fair = 'fair';
}
