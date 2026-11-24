<?php

namespace App\Support;

use Illuminate\Http\Request;

/** Query parsing that treats repeated keys and coercion the same way as the Express API. */
final class ApiQuery
{
    public static function all(Request $request): array
    {
        $query = [];
        foreach (explode('&', (string) $request->server('QUERY_STRING', '')) as $pair) {
            if ($pair === '') {
                continue;
            }
            [$key, $value] = array_pad(explode('=', $pair, 2), 2, '');
            $key = urldecode($key);
            $value = urldecode($value);
            if (array_key_exists($key, $query)) {
                $query[$key] = array_merge((array) $query[$key], [$value]);
            } else {
                $query[$key] = $value;
            }
        }

        return $query;
    }

    public static function strictKeys(array $query, array $allowed): void
    {
        ApiInput::strictKeys($query, $allowed);
    }

    public static function trimmed(array $query, string $key, int $max): ?string
    {
        if (! array_key_exists($key, $query)) {
            return null;
        }
        if (! is_string($query[$key])) {
            throw ApiInput::invalid($key, 'Invalid value');
        }

        $value = ApiInput::trim($query[$key]);
        if (ApiInput::length($value) > $max) {
            throw ApiInput::invalid($key, 'Invalid value', 'too_big');
        }

        return $value;
    }

    public static function string(array $query, string $key, int $max): ?string
    {
        if (! array_key_exists($key, $query)) {
            return null;
        }
        if (! is_string($query[$key]) || ApiInput::length($query[$key]) > $max) {
            throw ApiInput::invalid($key, 'Invalid value');
        }

        return $query[$key];
    }

    public static function enum(array $query, string $key, array $allowed, ?string $default = null): ?string
    {
        if (! array_key_exists($key, $query)) {
            return $default;
        }
        if (! is_string($query[$key]) || ! in_array($query[$key], $allowed, true)) {
            throw ApiInput::invalid($key, 'Invalid enum value', 'invalid_enum_value');
        }

        return $query[$key];
    }

    public static function int(array $query, string $key, ?int $default = null, ?int $min = null, ?int $max = null): ?int
    {
        if (! array_key_exists($key, $query)) {
            return $default;
        }

        $number = is_string($query[$key]) ? ApiInput::jsNumber($query[$key]) : null;
        if ($number === null || ! is_finite($number) || floor($number) !== $number || ($min !== null && $number < $min) || ($max !== null && $number > $max)) {
            throw ApiInput::invalid($key, 'Invalid number');
        }

        return (int) $number;
    }

    public static function number(array $query, string $key, float $min): ?float
    {
        if (! array_key_exists($key, $query)) {
            return null;
        }

        $number = is_string($query[$key]) ? ApiInput::jsNumber($query[$key]) : null;
        if ($number === null || ! is_finite($number) || $number < $min) {
            throw ApiInput::invalid($key, 'Invalid number');
        }

        return $number;
    }
}
