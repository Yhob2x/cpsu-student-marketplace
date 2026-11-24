<?php

namespace App\Support;

/** The current account. Roles are always loaded from the database, never from the token. */
final readonly class AuthUser
{
    /** @param list<array{role: string, campusId: int|null}> $roles */
    public function __construct(
        public int $id,
        public string $email,
        public string $displayName,
        public array $roles,
    ) {
    }
}
