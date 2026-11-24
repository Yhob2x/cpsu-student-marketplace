<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function json(mixed $data, int $status = 200, array $headers = []): JsonResponse
    {
        return new JsonResponse($data, $status, ['Content-Type' => 'application/json; charset=utf-8'] + $headers, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    public static function error(string $code, int $status, ?string $message = null): JsonResponse
    {
        return self::json(['error' => array_filter(['code' => $code, 'message' => $message], fn ($value) => $value !== null)], $status);
    }
}
