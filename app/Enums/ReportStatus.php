<?php

namespace App\Enums;

enum ReportStatus: string
{
    case open = 'open';
    case reviewing = 'reviewing';
    case resolved = 'resolved';
    case dismissed = 'dismissed';
}
