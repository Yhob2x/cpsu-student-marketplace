<?php

namespace App\Http\Middleware;

use App\Support\ApiInput;
use App\Support\AtomicRateLimit;
use App\Support\ManagedContent;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/** Per-account limits, so students sharing a campus network do not share a quota. */
class AccountRateLimit
{
    private const WINDOW_SECONDS = 900;

    public function handle(Request $request, Closure $next, string $bucket, string $limit): Response
    {
        // An invalid image slot is rejected without spending upload quota.
        if ($bucket === 'homepage-image' && ! in_array($request->route('slot'), ManagedContent::IMAGE_SLOTS, true)) {
            throw ApiInput::invalid('slot', 'Invalid enum value', 'invalid_enum_value');
        }

        $maximum = (int) $limit;
        $key = "{$bucket}:".$request->attributes->get('authUser')->id;
        $hits = AtomicRateLimit::hit($key, self::WINDOW_SECONDS);
        $retryAfter = max(1, RateLimiter::availableIn($key));
        $policy = sprintf('limit=%d, remaining=%d, reset=%d', $maximum, max(0, $maximum - $hits), $retryAfter);
        if ($hits > $maximum) {
            return response('Too many requests, please try again later.', 429, ['RateLimit' => $policy, 'Retry-After' => (string) $retryAfter, 'Content-Type' => 'text/html; charset=utf-8']);
        }

        $response = $next($request);
        $response->headers->set('RateLimit', $policy);

        return $response;
    }
}
