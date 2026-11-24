<?php

namespace App\Support;

use RuntimeException;

/** Equivalent of the Express HttpError: a safe status and machine-readable code. */
class ApiError extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $errorCode, ?string $message = null)
    {
        parent::__construct($message ?? $errorCode);
    }
}
