<?php

namespace App\Services;

/** Argon2id with the same parameters as the Express API, so existing passwords keep working. */
class PasswordHasher
{
    public function hash(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 4]);
    }

    public function verify(string $hash, string $password): bool
    {
        return password_verify($password, $hash);
    }
}
