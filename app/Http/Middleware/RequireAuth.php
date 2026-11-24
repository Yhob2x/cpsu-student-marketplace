<?php

namespace App\Http\Middleware;

use App\Support\ApiError;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->attributes->has('authUser')) {
            throw new ApiError(401, 'unauthenticated');
        }

        return $next($request);
    }
}
