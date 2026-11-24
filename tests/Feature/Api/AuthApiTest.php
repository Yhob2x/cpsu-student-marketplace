<?php

namespace Tests\Feature\Api;

use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\AuthenticateAccessToken;
use App\Http\Middleware\ParseJsonBody;
use App\Http\Middleware\RequireAuth;
use App\Http\Middleware\RequireReviewer;
use App\Http\Middleware\RequireStudent;
use App\Models\Affiliation;
use App\Models\Campus;
use App\Models\PushSubscription;
use App\Models\Session;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AccessTokens;
use App\Services\PasswordHasher;
use App\Services\PushEndpoints;
use Firebase\JWT\JWT;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    private const PASSWORD = '  Correct-Horse-Battery  ';

    private Campus $campus;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new RuntimeException('Refusing to run: tests must target the disposable database.');
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['PushSubscription', 'Session', 'StudentIdentity', 'Affiliation', 'UserRole', 'User', 'Campus'] as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        RateLimiter::clear('api-rate:auth:127.0.0.1');
        $this->campus = Campus::create(['code' => 'MAIN', 'name' => 'Main Campus', 'active' => true]);

        Route::prefix('api/v1/__test')->middleware([ApiResponseHeaders::class, ParseJsonBody::class, AuthenticateAccessToken::class])->group(function () {
            Route::get('auth', fn () => ['ok' => true])->middleware(RequireAuth::class);
            Route::get('student', fn () => ['ok' => true])->middleware(RequireStudent::class);
            Route::get('reviewer', fn () => ['ok' => true])->middleware(RequireReviewer::class);
        });
    }

    private function account(string $email = 'student@example.test', string $status = 'active'): User
    {
        return User::create(['email' => $email, 'displayName' => 'Test Student', 'passwordHash' => app(PasswordHasher::class)->hash(self::PASSWORD), 'status' => $status]);
    }

    private function registration(array $overrides = []): array
    {
        return $overrides + ['email' => 'New.Student@Example.test', 'password' => self::PASSWORD, 'displayName' => '  New Student  ', 'campusId' => $this->campus->id];
    }

    private function cookieFrom($response, string $name): ?string
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === $name) {
                return $cookie->getValue();
            }
        }

        return null;
    }

    private function refreshWith(string $token)
    {
        return $this->withCredentials()->withUnencryptedCookie('refresh', $token)->call('POST', '/api/v1/auth/refresh', [], ['refresh' => $token], [], ['HTTP_ACCEPT' => 'application/json']);
    }

    public function test_registration_policy_is_public_and_not_cached(): void
    {
        $this->getJson('/api/v1/auth/registration-policy')->assertOk()->assertExactJson(['studentIdentityRequired' => false])->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_register_creates_pending_student_with_argon2id_and_secure_cookies(): void
    {
        $response = $this->postJson('/api/v1/auth/register', $this->registration())->assertCreated()->assertJsonStructure(['accessToken'])->assertJsonMissingPath('refreshToken');
        $user = User::where('email', 'new.student@example.test')->firstOrFail();

        $this->assertSame('New Student', $user->displayName);
        $this->assertStringStartsWith('$argon2id$v=19$m=65536,t=3,p=4$', $user->passwordHash);
        $this->assertTrue(password_verify(self::PASSWORD, $user->passwordHash));
        $this->assertSame('pending', Affiliation::where('userId', $user->id)->firstOrFail()->verificationStatus->value);

        $cookies = collect($response->headers->getCookies())->keyBy(fn ($cookie) => $cookie->getName());
        $this->assertSame('/api/v1/auth', $cookies['refresh']->getPath());
        $this->assertSame('/api/v1/media', $cookies['media']->getPath());
        $this->assertTrue($cookies['refresh']->isHttpOnly());
        $this->assertSame('lax', $cookies['refresh']->getSameSite());
        $this->assertSame(hash('sha256', $cookies['refresh']->getValue()), Session::where('userId', $user->id)->firstOrFail()->getRawOriginal('refreshTokenHash'));
    }

    public function test_register_rejects_invalid_input_without_creating_accounts(): void
    {
        foreach ([
            ['email' => 'invalid'],
            ['password' => 'short'],
            ['password' => str_repeat('x', 129)],
            ['displayName' => ' x '],
            ['campusId' => '1'],
            ['campusId' => 1.5],
        ] as $invalid) {
            $this->postJson('/api/v1/auth/register', $this->registration($invalid))->assertStatus(400)->assertJsonPath('error.code', 'validation_error');
        }
        $this->assertSame(0, User::count());
    }

    public function test_register_business_rules(): void
    {
        $this->postJson('/api/v1/auth/register', $this->registration(['fullName' => 'Private Name']))->assertStatus(409)->assertJsonPath('error.code', 'student_identity_registration_unavailable');
        $this->postJson('/api/v1/auth/register', $this->registration(['campusId' => 999]))->assertStatus(400)->assertJsonPath('error.code', 'invalid_campus');
        $this->account('new.student@example.test');
        $this->postJson('/api/v1/auth/register', $this->registration())->assertStatus(409)->assertJsonPath('error.code', 'email_taken');
    }

    public function test_login_preserves_password_exactly_and_hides_account_state(): void
    {
        $this->account();
        $this->account('suspended@example.test', 'suspended');

        $this->postJson('/api/v1/auth/login', ['email' => 'STUDENT@example.test', 'password' => self::PASSWORD])->assertOk()->assertJsonStructure(['accessToken']);
        $this->postJson('/api/v1/auth/login', ['email' => 'student@example.test', 'password' => trim(self::PASSWORD)])->assertStatus(401)->assertJsonPath('error.code', 'invalid_credentials');
        $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.test', 'password' => self::PASSWORD])->assertStatus(401)->assertJsonPath('error.code', 'invalid_credentials');
        $this->postJson('/api/v1/auth/login', ['email' => 'suspended@example.test', 'password' => self::PASSWORD])->assertStatus(401)->assertJsonPath('error.code', 'invalid_credentials');
        $this->postJson('/api/v1/auth/login', ['email' => 'invalid', 'password' => 'x'])->assertStatus(400)->assertJsonPath('error.code', 'validation_error');
    }

    public function test_failed_logins_are_limited_per_account_and_successes_are_not_counted(): void
    {
        $this->account();
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'student@example.test', 'password' => self::PASSWORD])->assertOk();
        }
        foreach (range(1, 10) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'student@example.test', 'password' => 'wrong-password'])->assertStatus(401);
        }
        $limited = $this->postJson('/api/v1/auth/login', ['email' => ' STUDENT@example.test ', 'password' => self::PASSWORD])->assertStatus(429);
        $this->assertGreaterThan(0, (int) $limited->headers->get('Retry-After'));
    }

    public function test_refresh_rotates_and_reuse_revokes_every_session(): void
    {
        $user = $this->account();
        $first = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD]);
        $other = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD]);
        $token = $this->cookieFrom($first, 'refresh');

        $rotated = $this->refreshWith($token)->assertOk()->assertJsonStructure(['accessToken']);
        $this->assertNotSame($token, $this->cookieFrom($rotated, 'refresh'));

        $this->refreshWith($token)->assertNoContent();
        $this->assertSame(0, Session::where('userId', $user->id)->whereNull('revokedAt')->count());
        $this->refreshWith($this->cookieFrom($other, 'refresh'))->assertNoContent();
    }

    public function test_refresh_handles_guest_expired_suspended_and_mobile_clients(): void
    {
        $this->postJson('/api/v1/auth/refresh')->assertNoContent();
        $this->postJson('/api/v1/auth/refresh', [], ['x-client' => 'mobile'])->assertStatus(401)->assertJsonPath('error.code', 'no_session');
        $this->postJson('/api/v1/auth/refresh', ['refreshToken' => 'unknown'], ['x-client' => 'mobile'])->assertStatus(401)->assertJsonPath('error.code', 'session_expired');

        $user = $this->account();
        $login = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD], ['x-client' => 'mobile'])->assertOk()->assertJsonStructure(['accessToken', 'refreshToken']);
        $this->assertNull($this->cookieFrom($login, 'refresh'));
        $mobile = $login->json('refreshToken');
        $next = $this->postJson('/api/v1/auth/refresh', ['refreshToken' => $mobile], ['x-client' => 'mobile'])->assertOk()->json('refreshToken');

        Session::query()->where('refreshTokenHash', hash('sha256', $next))->update(['expiresAt' => Carbon::now()->subMinute()->format('Y-m-d H:i:s.v')]);
        $this->postJson('/api/v1/auth/refresh', ['refreshToken' => $next], ['x-client' => 'mobile'])->assertStatus(401);

        $browser = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD]);
        User::whereKey($user->id)->update(['status' => 'suspended']);
        $this->refreshWith($this->cookieFrom($browser, 'refresh'))->assertNoContent();
        $this->assertSame(0, Session::where('userId', $user->id)->whereNull('revokedAt')->count());
    }

    public function test_logout_is_strict_and_only_removes_the_matching_device(): void
    {
        $this->postJson('/api/v1/auth/logout', ['refreshToken' => 'unused', 'unexpectedProperty' => '<script>'])->assertStatus(400)->assertJsonPath('error.code', 'validation_error');

        $user = $this->account();
        $login = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD], ['x-client' => 'mobile']);
        $second = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD], ['x-client' => 'mobile']);
        $endpoint = 'https://fcm.googleapis.com/fcm/send/device-a';
        $kept = 'https://fcm.googleapis.com/fcm/send/device-b';
        foreach ([$endpoint, $kept] as $url) {
            PushSubscription::create(['userId' => $user->id, 'endpoint' => $url, 'endpointHash' => PushEndpoints::hash($url), 'p256dh' => 'key', 'auth' => 'auth']);
        }

        $this->postJson('/api/v1/auth/logout', ['refreshToken' => $login->json('refreshToken'), 'pushEndpoint' => $endpoint])->assertNoContent();

        $this->assertSame([PushEndpoints::hash($kept)], PushSubscription::query()->pluck('endpointHash')->all());
        $this->assertNotNull(Session::where('refreshTokenHash', hash('sha256', $login->json('refreshToken')))->firstOrFail()->revokedAt);
        $this->assertNull(Session::where('refreshTokenHash', hash('sha256', $second->json('refreshToken')))->firstOrFail()->revokedAt);
    }

    public function test_tokens_are_validated_and_live_account_state_is_enforced(): void
    {
        $user = $this->account();
        $secret = config('marketplace.jwt_secret');
        $valid = app(AccessTokens::class)->sign($user->id);

        $this->getJson('/api/v1/__test/auth')->assertStatus(401)->assertJsonPath('error.code', 'unauthenticated');
        $this->withToken($valid)->getJson('/api/v1/__test/auth')->assertOk();
        $this->withToken(JWT::encode(['sub' => (string) $user->id, 'exp' => time() - 60], $secret, 'HS256'))->getJson('/api/v1/__test/auth')->assertStatus(401);
        $this->withToken(JWT::encode(['sub' => (string) $user->id, 'exp' => time() + 60], str_repeat('w', 40), 'HS256'))->getJson('/api/v1/__test/auth')->assertStatus(401);
        $none = rtrim(strtr(base64_encode('{"alg":"none","typ":"JWT"}'), '+/', '-_'), '=').'.'.rtrim(strtr(base64_encode(json_encode(['sub' => (string) $user->id, 'exp' => time() + 60])), '+/', '-_'), '=').'.';
        $this->withToken($none)->getJson('/api/v1/__test/auth')->assertStatus(401);
        $this->withToken($valid.'x')->getJson('/api/v1/__test/auth')->assertStatus(401);

        User::whereKey($user->id)->update(['status' => 'suspended']);
        $this->withToken($valid)->getJson('/api/v1/__test/auth')->assertStatus(401);
    }

    public function test_student_and_reviewer_roles_are_enforced_on_the_server(): void
    {
        $student = $this->account();
        $reviewer = $this->account('reviewer@example.test');
        $system = $this->account('system@example.test');
        UserRole::create(['userId' => $reviewer->id, 'role' => 'campus_reviewer', 'campusId' => $this->campus->id]);
        UserRole::create(['userId' => $system->id, 'role' => 'system_admin', 'campusId' => null]);
        $tokens = app(AccessTokens::class);

        $this->withToken($tokens->sign($student->id))->getJson('/api/v1/__test/student')->assertOk();
        $this->withToken($tokens->sign($student->id))->getJson('/api/v1/__test/reviewer')->assertStatus(403)->assertJsonPath('error.code', 'forbidden');
        $this->withToken($tokens->sign($reviewer->id))->getJson('/api/v1/__test/reviewer')->assertOk();
        $this->withToken($tokens->sign($reviewer->id))->getJson('/api/v1/__test/student')->assertStatus(403)->assertJsonPath('error.code', 'student_account_required');
        $this->withToken($tokens->sign($system->id))->getJson('/api/v1/__test/reviewer')->assertStatus(403);
    }

    public function test_the_301st_write_is_rate_limited_with_retry_instructions(): void
    {
        foreach (range(1, 300) as $_) {
            $this->postJson('/api/v1/auth/refresh')->assertNoContent();
        }

        $limited = $this->postJson('/api/v1/auth/refresh')->assertStatus(429);
        $this->assertMatchesRegularExpression('/^[1-9]\d*$/', (string) $limited->headers->get('Retry-After'));
    }

    public function test_error_and_security_response_contract(): void
    {
        $bad = $this->call('POST', '/api/v1/auth/login', [], [], [], ['CONTENT_TYPE' => 'application/json'], '{bad json');
        $bad->assertStatus(500)->assertExactJson(['error' => ['code' => 'internal_error']]);
        $this->assertSame('nosniff', $bad->headers->get('X-Content-Type-Options'));
        $this->assertNotEmpty($bad->headers->get('X-Request-ID'));
        $this->assertStringContainsString("default-src 'self'", $bad->headers->get('Content-Security-Policy'));
    }
}
