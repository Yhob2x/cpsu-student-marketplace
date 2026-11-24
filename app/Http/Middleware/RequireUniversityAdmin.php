<?php

namespace App\Http\Middleware;

use App\Support\ApiError;
use App\Support\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Only a university-wide administrator passes. Campus-scoped roles do not. */
class RequireUniversityAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('authUser');
        if ($user === null) {
            throw new ApiError(401, 'unauthenticated');
        }
        if (! Permissions::canManageCatalog($user)) {
            throw new ApiError(403, 'forbidden');
        }

        return $next($request);
    }
}
