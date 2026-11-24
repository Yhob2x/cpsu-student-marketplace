<?php

namespace App\Enums;

enum AvailabilityState: string
{
    case available = 'available';
    case reserved = 'reserved';
    case sold = 'sold';
}
