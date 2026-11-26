<?php

namespace App\Providers;

use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if (config('marketplace.student_identity_enabled') && config('marketplace.student_identity_approval_ref') === '') {
            throw new RuntimeException('Student identity collection requires a recorded CPSU privacy approval reference.');
        }

        if ($this->app->isProduction()) {
            if (! config('marketplace.cookie_secure') || strlen((string) config('marketplace.jwt_secret')) < 32) {
                throw new RuntimeException('Unsafe production configuration: enable secure cookies and set JWT_SECRET.');
            }
        }

        // Production and isolated HTTPS device QA use a same-host reverse proxy.
        if ($this->app->isProduction() || (
            $this->app->environment('push-qa')
            && config('database.connections.mysql.database') === 'cpsu_marketplace_laravel_push_test'
            && config('marketplace.cookie_secure')
            && ! config('app.debug')
        )) {
            TrustProxies::at(['127.0.0.1', '::1']);
        }
    }
}
