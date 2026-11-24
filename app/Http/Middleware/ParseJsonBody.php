<?php

namespace App\Http\Middleware;

use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use JsonException;
use Symfony\Component\HttpFoundation\Response;

/** Strict JSON parsing with the same 100 KB limit as the Express API. */
class ParseJsonBody
{
    private const MAX_BYTES = 102400;

    public function handle(Request $request, Closure $next): Response
    {
        $type = strtolower(trim(explode(';', (string) $request->header('Content-Type'))[0]));
        if ($type !== 'application/json') {
            return $next($request);
        }

        $content = (string) $request->getContent();
        if ($content === '') {
            return $next($request);
        }
        if (strlen($content) > self::MAX_BYTES) {
            return ApiResponse::error('internal_error', 500);
        }

        $trimmed = ltrim($content, " \t\r\n");
        if ($trimmed === '' || ! in_array($trimmed[0], ['{', '['], true)) {
            return ApiResponse::error('internal_error', 500);
        }

        try {
            $body = json_decode($content, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return ApiResponse::error('internal_error', 500);
        }

        $request->attributes->set('apiBody', $body);
        $request->attributes->set('apiBodyPresent', true);
        $request->attributes->set('apiBodyIsObject', $trimmed[0] === '{');

        return $next($request);
    }
}
