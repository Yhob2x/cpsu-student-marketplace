<?php

namespace App\Http\Middleware;

use App\Support\ApiError;
use App\Support\Permissions;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireStudent
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('authUser');
        if ($user === null) {
            throw new ApiError(401, 'unauthenticated');
        }
        if (Permissions::isStaffAccount($user->roles)) {
            throw new ApiError(403, 'student_account_required');
        }

        return $next($request);
    }
}
