<?php

use App\Support\ApiError;
use App\Support\ApiResponse;
use App\Support\ApiValidationError;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull;
use Illuminate\Foundation\Http\Middleware\TrimStrings;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Passwords and message text must reach the application exactly as submitted.
        $middleware->remove([TrimStrings::class, ConvertEmptyStringsToNull::class]);

        // The web group only serves the static React shell. Authentication stays on the API.
        $middleware->web(remove: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            ValidateCsrfToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->dontReport([ApiError::class, ApiValidationError::class]);

        $exceptions->render(function (Throwable $error, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return match (true) {
                $error instanceof ApiValidationError => ApiResponse::json(['error' => ['code' => 'validation_error', 'issues' => $error->issues]], 400),
                $error instanceof ApiError => ApiResponse::error($error->errorCode, $error->status, $error->getMessage()),
                $error instanceof NotFoundHttpException, $error instanceof MethodNotAllowedHttpException => ApiResponse::error('not_found', 404),
                $error instanceof QueryException && in_array((int) ($error->errorInfo[1] ?? 0), [1205, 1213], true) => ApiResponse::error('concurrent_transaction_conflict', 409),
                default => ApiResponse::error('internal_error', 500),
            };
        });
    })->create();
