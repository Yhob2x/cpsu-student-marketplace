<?php

namespace Tests\Feature\Api;

use App\Models\Notification;
use App\Models\PushAttempt;
use App\Models\PushOutbox;
use App\Models\PushPreference;
use App\Models\PushSubscription;
use App\Models\User;
use App\Services\AccessTokens;
use App\Services\PushDelivery;
use App\Services\PushPolicy;
use App\Services\PushTransport;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class RealtimePushApiTest extends TestCase
{
    private User $recipient;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new \RuntimeException('Refusing to run outside the disposable database.');
        }
        DB::beginTransaction();
        $this->recipient = User::create(['email' => 'push-'.bin2hex(random_bytes(5)).'@example.test', 'displayName' => 'Synthetic Recipient', 'passwordHash' => 'test-only', 'status' => 'active']);
    }

    protected function tearDown(): void
    {
        DB::rollBack();
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_realtime_config_and_authorization_are_private(): void
    {
        config(['realtime.enabled' => true, 'realtime.key' => 'test-key', 'realtime.secret' => 'test-only-secret', 'realtime.app_id' => 'test-app']);
        $this->getJson('/api/v1/realtime/config')->assertUnauthorized();
        $this->withToken(app(AccessTokens::class)->sign($this->recipient->id));
        $this->getJson('/api/v1/realtime/config')->assertOk()->assertJsonPath('enabled', true)->assertJsonMissing(['secret' => 'test-only-secret']);
        $channel = 'private-market-user.'.$this->recipient->id;
        $this->postJson('/api/v1/realtime/auth', ['channel_name' => $channel, 'socket_id' => '1.2'])->assertOk()
            ->assertJsonPath('auth', 'test-key:'.hash_hmac('sha256', '1.2:'.$channel, 'test-only-secret'));
        $this->postJson('/api/v1/realtime/auth', ['channel_name' => 'private-market-user.'.($this->recipient->id + 1), 'socket_id' => '1.2'])->assertForbidden();
        $this->postJson('/api/v1/realtime/auth', ['channel_name' => 'public-market', 'socket_id' => '1.2'])->assertForbidden();
        $this->postJson('/api/v1/realtime/auth', ['channel_name' => $channel, 'socket_id' => 'not-valid'])->assertStatus(400);
    }

    private function fakeTransport(int $code = 201): PushDelivery
    {
        $policy = $this->mock(PushPolicy::class);
        $policy->shouldReceive('deliveryEnabled')->andReturn(true);
        $transport = $this->mock(PushTransport::class);
        $transport->shouldReceive('send')->andReturnUsing(function ($device, $payload) use ($code) {
            $this->assertSame($this->recipient->id, $device->userId);
            $this->assertSame('/notifications', $payload['url']);
            $this->assertSame('You have a new marketplace update.', $payload['body']);
            $this->assertStringNotContainsString('private-message', json_encode($payload));
            return $code;
        });
        return app(PushDelivery::class);
    }

    private function device(): PushSubscription
    {
        $endpoint = 'https://fcm.googleapis.com/fcm/send/synthetic-'.bin2hex(random_bytes(5));
        return PushSubscription::create(['userId' => $this->recipient->id, 'endpointHash' => hash('sha256', $endpoint), 'endpoint' => $endpoint, 'p256dh' => 'fake-key', 'auth' => 'fake-auth']);
    }

    private function notice(): Notification
    {
        return Notification::create(['userId' => $this->recipient->id, 'type' => 'listing.decision', 'payload' => ['private' => 'private-message']]);
    }

    public function test_delivery_requires_both_flags_valid_keys_and_approval(): void
    {
        $keys = \Minishlink\WebPush\VAPID::createVapidKeys();
        config([
            'marketplace.push.subscriptions_enabled' => true,
            'marketplace.push.delivery_enabled' => true,
            'marketplace.push.delivery_approval_ref' => '',
            'marketplace.push.vapid_public_key' => $keys['publicKey'],
            'marketplace.push.vapid_private_key' => $keys['privateKey'],
            'marketplace.push.vapid_subject' => 'mailto:qa@example.invalid',
        ]);
        $policy = app(PushPolicy::class);
        $this->assertTrue($policy->subscriptionsEnabled());
        $this->assertFalse($policy->deliveryEnabled());
        config(['marketplace.push.delivery_approval_ref' => 'synthetic-qa-only']);
        $this->assertTrue($policy->deliveryEnabled());
        config(['marketplace.push.delivery_enabled' => false]);
        $this->assertFalse($policy->deliveryEnabled());
    }

    public function test_push_outbox_is_idempotent_and_delivers_only_generic_payload(): void
    {
        $delivery = $this->fakeTransport();
        $this->device();
        $notice = $this->notice();
        $delivery->enqueue($notice);
        $this->assertSame(1, PushOutbox::where('notificationId', $notice->id)->count());
        $this->assertSame(1, $delivery->drain());
        $job = PushOutbox::where('notificationId', $notice->id)->firstOrFail();
        $this->assertSame('sent', $job->state);
        $this->assertSame('sent', PushAttempt::where('outboxId', $job->id)->firstOrFail()->state);
        $this->assertSame(0, $delivery->drain());
    }

    public function test_disabled_category_skips_without_contacting_provider(): void
    {
        $policy = $this->mock(PushPolicy::class);
        $policy->shouldReceive('deliveryEnabled')->andReturn(true);
        $this->mock(PushTransport::class)->shouldNotReceive('send');
        $this->device();
        PushPreference::create(['userId' => $this->recipient->id, 'listingReviews' => false]);
        $notice = $this->notice();
        app(PushDelivery::class)->drain();
        $this->assertSame('skipped', PushOutbox::where('notificationId', $notice->id)->value('state'));
    }

    public function test_transient_failure_retries_and_expired_device_is_removed(): void
    {
        $delivery = $this->fakeTransport(503);
        $device = $this->device();
        $notice = $this->notice();
        $delivery->drain();
        $job = PushOutbox::where('notificationId', $notice->id)->firstOrFail();
        $this->assertSame('pending', $job->state);
        $this->assertSame(1, $job->attemptCount);
        Carbon::setTestNow(Carbon::now()->addMinute());
        $delivery = $this->fakeTransport(410);
        $delivery->drain();
        $this->assertNull(PushSubscription::find($device->id));
        $this->assertSame('failed', $job->fresh()->state);
    }
}
