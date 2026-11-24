<?php

namespace App\Enums;

enum Role: string
{
    case campus_reviewer = 'campus_reviewer';
    case university_admin = 'university_admin';
    case system_admin = 'system_admin';
    case establishment = 'establishment';
}
