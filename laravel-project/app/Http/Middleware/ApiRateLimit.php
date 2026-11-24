<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/** IP budgets: separate read and write buckets, plus a stricter authentication bucket. */
class ApiRateLimit
{
    public function handle(Request $request, Closure $next, string $scope = 'global'): Response
    {
        $limits = config('marketplace.rate_limits');
        [$bucket, $limit, $decay] = match (true) {
            $scope === 'auth' => ['auth', $limits['auth_per_15_minutes'], 900],
            $request->isMethod('GET') => ['read', $limits['reads_per_minute'], 60],
            default => ['write', $limits['writes_per_minute'], 60],
        };

        $key = "api-rate:{$bucket}:".$request->ip();
        $hits = RateLimiter::hit($key, $decay);
        $retryAfter = max(1, RateLimiter::availableIn($key));
        $headers = [
            'X-RateLimit-Limit' => (string) $limit,
            'X-RateLimit-Remaining' => (string) max(0, $limit - $hits),
            'X-RateLimit-Reset' => (string) (time() + $retryAfter),
        ];

        if ($hits > $limit) {
            return response('Too many requests, please try again later.', 429, $headers + ['Retry-After' => (string) $retryAfter, 'Content-Type' => 'text/html; charset=utf-8']);
        }

        $response = $next($request);
        $response->headers->add($headers);

        return $response;
    }
}
