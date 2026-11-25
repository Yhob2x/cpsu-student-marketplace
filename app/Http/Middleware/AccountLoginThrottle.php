<?php

namespace App\Http\Middleware;

use App\Support\ApiInput;
use App\Support\AtomicRateLimit;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/** Limits failed logins per account. Keys are HMACs, so email addresses are not stored in the cache. */
class AccountLoginThrottle
{
    private const WINDOW_SECONDS = 900;

    public function handle(Request $request, Closure $next): Response
    {
        $body = $request->attributes->get('apiBodyIsObject') === true ? $request->attributes->get('apiBody') : [];
        $email = $body['email'] ?? null;
        if (! is_string($email) || ApiInput::trim($email) === '') {
            return $next($request);
        }

        $limit = config('marketplace.rate_limits.failed_logins_per_account');
        $digest = hash_hmac('sha256', mb_strtolower(ApiInput::trim($email)), (string) config('marketplace.jwt_secret'));
        $key = "api-login-account:{$digest}";

        // Count before verifying so parallel guesses cannot exceed the limit.
        $hits = AtomicRateLimit::hit($key, self::WINDOW_SECONDS);
        $retryAfter = max(1, RateLimiter::availableIn($key));
        $policy = sprintf('limit=%d, remaining=%d, reset=%d', $limit, max(0, $limit - $hits), $retryAfter);
        if ($hits > $limit) {
            return response('Too many requests, please try again later.', 429, ['RateLimit' => $policy, 'Retry-After' => (string) $retryAfter, 'Content-Type' => 'text/html; charset=utf-8']);
        }

        $response = $next($request);
        if ($response->getStatusCode() < 400) {
            AtomicRateLimit::decrement($key, self::WINDOW_SECONDS);
        }
        $response->headers->set('RateLimit', $policy);

        return $response;
    }
}
