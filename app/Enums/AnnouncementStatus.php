<?php

namespace App\Enums;

enum AnnouncementStatus: string
{
    case draft = 'draft';
    case published = 'published';
    case archived = 'archived';
}
