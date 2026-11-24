<?php

namespace App\Services;

use App\Models\AuditLog;

class AuditLogger
{
    public function record(?int $actorUserId, string $action, string $targetType, ?int $targetId = null, ?array $metadata = null): AuditLog
    {
        return AuditLog::create(compact('actorUserId', 'action', 'targetType', 'targetId', 'metadata'));
    }
}
