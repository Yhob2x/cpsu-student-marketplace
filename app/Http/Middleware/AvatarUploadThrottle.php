<?php

namespace App\Http\Middleware;

use App\Support\AtomicRateLimit;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/** Bounds per-account demand on the photo classifier. */
class AvatarUploadThrottle
{
    private const LIMIT = 10;

    private const WINDOW_SECONDS = 900;

    public function handle(Request $request, Closure $next): Response
    {
        $key = 'seller-avatar:'.$request->attributes->get('authUser')->id;
        $hits = AtomicRateLimit::hit($key, self::WINDOW_SECONDS);
        $retryAfter = max(1, RateLimiter::availableIn($key));
        $policy = sprintf('limit=%d, remaining=%d, reset=%d', self::LIMIT, max(0, self::LIMIT - $hits), $retryAfter);
        if ($hits > self::LIMIT) {
            return response('Too many requests, please try again later.', 429, ['RateLimit' => $policy, 'Retry-After' => (string) $retryAfter, 'Content-Type' => 'text/html; charset=utf-8']);
        }

        $response = $next($request);
        $response->headers->set('RateLimit', $policy);

        return $response;
    }
}
