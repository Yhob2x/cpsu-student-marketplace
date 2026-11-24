<?php

namespace App\Support;

use RuntimeException;

class ApiValidationError extends RuntimeException
{
    /** @param list<array{code: string, path: list<string>, message: string}> $issues */
    public function __construct(public readonly array $issues)
    {
        parent::__construct('validation_error');
    }
}
