<?php

namespace App\Enums;

enum UserStatus: string
{
    case active = 'active';
    case suspended = 'suspended';
}
