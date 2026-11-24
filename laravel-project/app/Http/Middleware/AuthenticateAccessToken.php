<?php

namespace App\Http\Middleware;

use App\Enums\UserStatus;
use App\Models\User;
use App\Services\AccessTokens;
use App\Support\AuthUser;
use App\Support\AuthCookies;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/** Resolves the account on every request. Status and roles always come from the database. */
class AuthenticateAccessToken
{
    public function __construct(private readonly AccessTokens $tokens)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->headers->get('Authorization');
        if ($header === null && $request->cookies->get(AuthCookies::MEDIA)) {
            $header = 'Bearer '.$request->cookies->get(AuthCookies::MEDIA);
        }

        if (is_string($header) && str_starts_with($header, 'Bearer ')) {
            try {
                $userId = $this->tokens->userId(substr($header, 7));
                $user = $userId === null ? null : User::query()
                    ->select(['id', 'email', 'displayName', 'status'])
                    ->with('roles:userId,role,campusId')
                    ->find($userId);

                if ($user !== null && $user->status === UserStatus::active) {
                    $authUser = new AuthUser($user->id, $user->email, $user->displayName, $user->roles
                        ->map(fn ($role) => ['role' => $role->role->value, 'campusId' => $role->campusId])
                        ->values()->all());
                    $request->attributes->set('authUser', $authUser);
                    $request->setUserResolver(fn () => $authUser);
                }
            } catch (Throwable) {
                // Treated as signed out, matching the Express middleware.
            }
        }

        return $next($request);
    }
}
