<?php

namespace App\Http\Middleware;

use App\Support\ApiError;
use App\Support\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireReviewer
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('authUser');
        if ($user === null) {
            throw new ApiError(401, 'unauthenticated');
        }

        $campuses = Permissions::reviewCampusIds($user);
        if ($campuses !== 'all' && $campuses === []) {
            throw new ApiError(403, 'forbidden');
        }

        return $next($request);
    }
}
