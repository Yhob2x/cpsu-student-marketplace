<?php

namespace App\Support;

use Illuminate\Http\Request;

/** Strict JSON input helpers matching the validation rules used by the Express API. */
class ApiInput
{
    private const EMAIL = "/^(?!\\.)(?!.*\\.\\.)([A-Z0-9_'+\\-\\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\\-]*\\.)+[A-Z]{2,}$/i";

    public static function hasBody(Request $request): bool
    {
        return $request->attributes->get('apiBodyPresent', false) === true;
    }

    public static function object(Request $request): array
    {
        if (! self::hasBody($request) || $request->attributes->get('apiBodyIsObject') !== true) {
            throw self::invalid('body', 'Expected object');
        }

        return $request->attributes->get('apiBody');
    }

    public static function invalid(string $field, string $message, string $code = 'invalid_type'): ApiValidationError
    {
        return new ApiValidationError([['code' => $code, 'path' => $field === 'body' ? [] : [$field], 'message' => $message]]);
    }

    public static function email(array $body, string $field = 'email'): string
    {
        $value = $body[$field] ?? null;
        if (! is_string($value) || preg_match(self::EMAIL, $value) !== 1) {
            throw self::invalid($field, 'Invalid email', 'invalid_string');
        }

        return mb_strtolower($value);
    }

    public static function string(array $body, string $field, ?int $min = null, ?int $max = null, bool $trim = false): string
    {
        $value = $body[$field] ?? null;
        if (! is_string($value)) {
            throw self::invalid($field, 'Required');
        }

        $value = $trim ? self::trim($value) : $value;
        $length = self::length($value);
        if (($min !== null && $length < $min) || ($max !== null && $length > $max)) {
            throw self::invalid($field, 'Invalid length', $min !== null && $length < $min ? 'too_small' : 'too_big');
        }

        return $value;
    }

    public static function integer(array $body, string $field): int
    {
        $value = $body[$field] ?? null;
        if (is_float($value) && floor($value) === $value && abs($value) <= 9007199254740991) {
            return (int) $value;
        }
        if (! is_int($value) || abs($value) > 9007199254740991) {
            throw self::invalid($field, 'Expected integer');
        }

        return $value;
    }

    public static function trim(string $value): string
    {
        return (string) preg_replace('/^[\s\p{Z}\x{FEFF}]+|[\s\p{Z}\x{FEFF}]+$/u', '', $value);
    }

    /** JavaScript string length, so existing limits count characters identically. */
    public static function length(string $value): int
    {
        return (int) (strlen((string) mb_convert_encoding($value, 'UTF-16LE', 'UTF-8')) / 2);
    }

    public static function printable(string $value): bool
    {
        return preg_match('/[\x{0000}-\x{001F}\x{007F}]/u', $value) !== 1;
    }

    public static function url(mixed $value): bool
    {
        return is_string($value) && preg_match('/^[a-z][a-z0-9+.-]*:\S+$/i', $value) === 1;
    }
}
