<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class ApiResponse
{
    public static function json(mixed $data, int $status = 200, array $headers = []): JsonResponse
    {
        $response = new JsonResponse([], $status, ['Content-Type' => 'application/json; charset=utf-8'] + $headers, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        // setData keeps an intentional JSON null, which the constructor would turn into {}.
        return $response->setData($data);
    }

    public static function error(string $code, int $status, ?string $message = null): JsonResponse
    {
        return self::json(['error' => array_filter(['code' => $code, 'message' => $message], fn ($value) => $value !== null)], $status);
    }

    public static function date(?DateTimeInterface $date): ?string
    {
        return $date === null ? null : Carbon::instance($date)->utc()->format('Y-m-d\TH:i:s.v\Z');
    }
}
