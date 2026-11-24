<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\LegacyApiProxyController;
use App\Http\Middleware\AccountLoginThrottle;
use App\Http\Middleware\ApiRateLimit;
use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\AuthenticateAccessToken;
use App\Http\Middleware\ParseJsonBody;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')
    ->middleware([ApiResponseHeaders::class, ParseJsonBody::class, ApiRateLimit::class.':global', AuthenticateAccessToken::class])
    ->group(function () {
        Route::prefix('auth')->middleware(ApiRateLimit::class.':auth')->group(function () {
            Route::get('registration-policy', [AuthController::class, 'registrationPolicy']);
            Route::post('register', [AuthController::class, 'register']);
            Route::post('login', [AuthController::class, 'login'])->middleware(AccountLoginThrottle::class);
            Route::post('refresh', [AuthController::class, 'refresh']);
            Route::post('logout', [AuthController::class, 'logout']);
        });
    });

// Temporary migration bridge: routes not yet ported to Laravel continue to reach Express locally.
if (app()->environment('local') && config('services.legacy_api.url')) {
    Route::any('{path}', LegacyApiProxyController::class)->where('path', '.*');
}
