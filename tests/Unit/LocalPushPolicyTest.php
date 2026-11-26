<?php

namespace Tests\Unit;

use App\Services\PushPolicy;
use Minishlink\WebPush\VAPID;
use Tests\TestCase;

class LocalPushPolicyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->instance('env', 'local');
        $keys = VAPID::createVapidKeys();
        config([
            'app.debug' => false,
            'app.url' => 'https://qa.cpsu.edu.ph',
            'database.default' => 'mysql',
            'database.connections.mysql.url' => null,
            'database.connections.mysql.unix_socket' => '',
            'database.connections.mysql.host' => '127.0.0.1',
            'database.connections.mysql.database' => 'cpsu_marketplace_laravel_push_test',
            'marketplace.cookie_secure' => true,
            'marketplace.push.origins' => 'https://qa.cpsu.edu.ph',
            'marketplace.push.local_test_enabled' => true,
            'marketplace.push.subscriptions_enabled' => true,
            'marketplace.push.delivery_enabled' => true,
            'marketplace.push.delivery_approval_ref' => '',
            'marketplace.push.vapid_public_key' => $keys['publicKey'],
            'marketplace.push.vapid_private_key' => $keys['privateKey'],
            'marketplace.push.vapid_subject' => 'mailto:qa@cpsu.edu.ph',
        ]);
    }

    public function test_local_opt_in_allows_only_isolated_https_testing(): void
    {
        $policy = app(PushPolicy::class);
        $this->assertTrue($policy->subscriptionsEnabled());
        $this->assertTrue($policy->deliveryEnabled());
        foreach ([
            'marketplace.push.local_test_enabled' => false,
            'app.debug' => true,
            'marketplace.cookie_secure' => false,
            'database.connections.mysql.database' => 'cpsu_marketplace',
            'database.connections.mysql.host' => 'remote-db',
            'database.connections.mysql.url' => 'mysql://remote-db/other',
            'marketplace.push.origins' => 'http://172.16.126.181:8000',
            'app.url' => 'https://other.cpsu.edu.ph',
            'marketplace.push.subscriptions_enabled' => false,
            'marketplace.push.vapid_private_key' => 'invalid',
        ] as $key => $bad) {
            $original = config($key);
            config([$key => $bad]);
            $this->assertFalse($policy->subscriptionsEnabled(), $key);
            $this->assertFalse($policy->deliveryEnabled(), $key);
            config([$key => $original]);
        }
        config(['marketplace.push.delivery_enabled' => false]);
        $this->assertTrue($policy->subscriptionsEnabled());
        $this->assertFalse($policy->deliveryEnabled());
    }

    public function test_production_and_automated_tests_still_require_approval(): void
    {
        $policy = app(PushPolicy::class);
        foreach (['production', 'testing'] as $environment) {
            $this->app->instance('env', $environment);
            config(['marketplace.push.delivery_approval_ref' => '']);
            $this->assertTrue($policy->subscriptionsEnabled());
            $this->assertFalse($policy->deliveryEnabled());
            config(['marketplace.push.delivery_approval_ref' => 'synthetic-approval']);
            $this->assertTrue($policy->deliveryEnabled());
        }
    }
}
