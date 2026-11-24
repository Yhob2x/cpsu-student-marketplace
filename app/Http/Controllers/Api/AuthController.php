<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Enums\VerificationStatus;
use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\Campus;
use App\Models\PushSubscription;
use App\Models\Session;
use App\Models\StudentIdentity;
use App\Models\User;
use App\Services\AccessTokens;
use App\Services\PasswordHasher;
use App\Services\PushEndpoints;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\AuthCookies;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AuthController extends Controller
{
    private const REFRESH_DAYS = 30;

    public function __construct(
        private readonly AccessTokens $tokens,
        private readonly PasswordHasher $passwords,
    ) {
    }

    public function registrationPolicy(): JsonResponse
    {
        return ApiResponse::json(['studentIdentityRequired' => $this->identityEnabled()], 200, ['Cache-Control' => 'no-store']);
    }

    public function register(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        $email = ApiInput::email($body);
        $password = ApiInput::string($body, 'password', 10, 128);
        $displayName = ApiInput::string($body, 'displayName', 2, 80, true);
        $campusId = ApiInput::integer($body, 'campusId');

        // Never silently discard a submitted private identifier while collection is off.
        if (! $this->identityEnabled() && (array_key_exists('fullName', $body) || array_key_exists('studentIdNumber', $body))) {
            throw new ApiError(409, 'student_identity_registration_unavailable');
        }
        $identity = $this->identityEnabled() ? $this->identity($body) : null;

        if (! Campus::query()->whereKey($campusId)->where('active', true)->exists()) {
            throw new ApiError(400, 'invalid_campus');
        }
        if (User::query()->where('email', $email)->exists()) {
            throw new ApiError(409, 'email_taken');
        }

        $passwordHash = $this->passwords->hash($password);
        try {
            $user = DB::transaction(function () use ($email, $displayName, $passwordHash, $campusId, $identity) {
                $user = User::create(['email' => $email, 'displayName' => $displayName, 'passwordHash' => $passwordHash]);
                Affiliation::create(['userId' => $user->id, 'campusId' => $campusId, 'verificationStatus' => VerificationStatus::pending]);
                if ($identity !== null) {
                    StudentIdentity::create(['userId' => $user->id] + $identity);
                }

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            // A simultaneous sign-up won the race for this address.
            throw new ApiError(409, 'email_taken');
        }

        return $this->issue($request, $user->id, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        $email = ApiInput::email($body);
        $password = ApiInput::string($body, 'password');

        $user = User::query()->where('email', $email)->first();
        if ($user === null || $user->status !== UserStatus::active || ! $this->passwords->verify($user->passwordHash, $password)) {
            throw new ApiError(401, 'invalid_credentials');
        }

        return $this->issue($request, $user->id);
    }

    public function refresh(Request $request): JsonResponse|Response
    {
        $token = $this->presentedToken($request);
        $mobile = $this->isMobile($request);

        // A browser opening as a guest has no refresh cookie. That is a normal session probe.
        if ($token === null || $token === '') {
            if ($mobile) {
                throw new ApiError(401, 'no_session');
            }

            return response()->noContent();
        }

        $session = Session::query()->where('refreshTokenHash', $this->hashToken($token))->first();
        if ($session === null || $session->revokedAt !== null || $session->expiresAt->lt(Carbon::now())) {
            // Reuse of a rotated token suggests theft, so every session of that user is revoked.
            if ($session !== null) {
                $this->revokeAll($session->userId);
            }

            return $this->expired($mobile);
        }

        // A refresh token must never mint credentials for an account suspended since login.
        $owner = User::query()->select(['id', 'status'])->find($session->userId);
        if ($owner === null || $owner->status !== UserStatus::active) {
            $this->revokeAll($session->userId);

            return $this->expired($mobile);
        }

        $now = $this->timestamp();
        $claimed = Session::query()->whereKey($session->id)->whereNull('revokedAt')->where('expiresAt', '>', $now)->update(['revokedAt' => $now]);
        if ($claimed !== 1) {
            return $this->expired($mobile);
        }

        return $this->issue($request, $session->userId);
    }

    public function logout(Request $request): Response
    {
        $body = [];
        if (ApiInput::hasBody($request)) {
            $body = ApiInput::object($request);
        }

        foreach (array_keys($body) as $key) {
            if (! in_array($key, ['pushEndpoint', 'refreshToken'], true)) {
                throw ApiInput::invalid((string) $key, 'Unrecognized key', 'unrecognized_keys');
            }
        }
        $pushEndpoint = $body['pushEndpoint'] ?? null;
        if ($pushEndpoint !== null && (! ApiInput::url($pushEndpoint) || ApiInput::length($pushEndpoint) > 2048)) {
            throw ApiInput::invalid('pushEndpoint', 'Invalid url', 'invalid_string');
        }
        if (array_key_exists('refreshToken', $body) && ! is_string($body['refreshToken'])) {
            throw ApiInput::invalid('refreshToken', 'Expected string');
        }

        $token = $this->presentedToken($request, $body);
        if ($token !== null && $token !== '') {
            $session = Session::query()->select(['id', 'userId'])->where('refreshTokenHash', $this->hashToken($token))->first();
            if ($session !== null) {
                DB::transaction(function () use ($session, $pushEndpoint) {
                    $now = $this->timestamp();
                    $revoked = Session::query()->whereKey($session->id)->whereNull('revokedAt')->where('expiresAt', '>', $now)->update(['revokedAt' => $now]);
                    // Other devices stay active. A failed write rolls back both changes.
                    if ($revoked === 1 && $pushEndpoint !== null && PushEndpoints::permitted($pushEndpoint)) {
                        PushSubscription::query()->where('userId', $session->userId)->where('endpointHash', PushEndpoints::hash($pushEndpoint))->delete();
                    }
                });
            }
        }

        $response = response()->noContent();
        AuthCookies::clear($response);

        return $response;
    }

    private function issue(Request $request, int $userId, int $status = 200): JsonResponse
    {
        $refresh = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
        Session::create([
            'userId' => $userId,
            'refreshTokenHash' => $this->hashToken($refresh),
            'device' => mb_substr((string) $request->userAgent(), 0, 190),
            'expiresAt' => Carbon::now()->addDays(self::REFRESH_DAYS),
        ]);

        $mobile = $this->isMobile($request);
        $accessToken = $this->tokens->sign($userId);
        $response = ApiResponse::json(['accessToken' => $accessToken] + ($mobile ? ['refreshToken' => $refresh] : []), $status);
        if (! $mobile) {
            AuthCookies::attach($response, $refresh, $accessToken, self::REFRESH_DAYS);
        }

        return $response;
    }

    private function expired(bool $mobile): Response
    {
        if ($mobile) {
            throw new ApiError(401, 'session_expired');
        }

        $response = response()->noContent();
        AuthCookies::clear($response);

        return $response;
    }

    private function identity(array $body): array
    {
        $fullName = ApiInput::string($body, 'fullName', 2, 120, true);
        $studentIdNumber = ApiInput::string($body, 'studentIdNumber', 3, 48, true);
        if (! ApiInput::printable($fullName)) {
            throw ApiInput::invalid('fullName', 'Enter a valid full name.', 'custom');
        }
        if (! ApiInput::printable($studentIdNumber)) {
            throw ApiInput::invalid('studentIdNumber', 'Enter a valid student ID number.', 'custom');
        }

        return compact('fullName', 'studentIdNumber');
    }

    private function presentedToken(Request $request, ?array $body = null): ?string
    {
        $cookie = $request->cookies->get(AuthCookies::REFRESH);
        if ($cookie !== null) {
            return (string) $cookie;
        }

        $body ??= $request->attributes->get('apiBodyIsObject') === true ? $request->attributes->get('apiBody') : [];
        $token = $body['refreshToken'] ?? null;
        if ($token !== null && ! is_string($token)) {
            throw new RuntimeException('Refresh token must be a string.');
        }

        return $token;
    }

    private function revokeAll(int $userId): void
    {
        Session::query()->where('userId', $userId)->whereNull('revokedAt')->update(['revokedAt' => $this->timestamp()]);
    }

    private function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    private function timestamp(): string
    {
        return Carbon::now('UTC')->format('Y-m-d H:i:s.v');
    }

    private function isMobile(Request $request): bool
    {
        return $request->header('x-client') === 'mobile';
    }

    private function identityEnabled(): bool
    {
        return (bool) config('marketplace.student_identity_enabled');
    }
}
