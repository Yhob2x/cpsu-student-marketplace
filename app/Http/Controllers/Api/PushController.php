<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushPreference;
use App\Models\PushSubscription;
use App\Services\PushEndpoints;
use App\Services\PushPolicy;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\Tx;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Device enrollment and preferences only. This API sends no push messages. */
class PushController extends Controller
{
    private const DEFAULTS = ['messages' => true, 'listingReviews' => true, 'accountUpdates' => true];

    private const MAX_DEVICES = 8;

    public function __construct(private readonly PushPolicy $policy) {}

    public function config(): JsonResponse
    {
        return ApiResponse::json([
            'enabled' => $this->policy->subscriptionsEnabled(),
            'deliveryEnabled' => $this->policy->deliveryEnabled(),
            'publicKey' => $this->policy->publicKey(),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    /** POST keeps capability URLs out of browser history, proxies and access logs. */
    public function status(Request $request): JsonResponse
    {
        $endpoint = $this->endpointBody($request);
        $headers = ['Cache-Control' => 'no-store'];
        if (! $this->policy->subscriptionsEnabled() || ! PushEndpoints::permitted($endpoint)) {
            return ApiResponse::json(['registered' => false], 200, $headers);
        }

        $row = PushSubscription::query()->where('endpointHash', PushEndpoints::hash($endpoint))->first(['userId', 'expiresAt']);
        $registered = $row !== null && $row->userId === $request->attributes->get('authUser')->id
            && ($row->expiresAt === null || $row->expiresAt->gt(Carbon::now()));

        return ApiResponse::json(['registered' => $registered], 200, $headers);
    }

    public function preferences(Request $request): JsonResponse
    {
        $headers = ['Cache-Control' => 'no-store'];
        if (! $this->policy->subscriptionsEnabled()) {
            return ApiResponse::json(self::DEFAULTS, 200, $headers);
        }

        $row = PushPreference::query()->find($request->attributes->get('authUser')->id, ['messages', 'listingReviews', 'accountUpdates']);

        return ApiResponse::json($row?->toArray() ?? self::DEFAULTS, 200, $headers);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        if (! $this->policy->subscriptionsEnabled()) {
            throw new ApiError(503, 'push_not_configured');
        }

        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, array_keys(self::DEFAULTS));
        $data = [];
        foreach (array_keys(self::DEFAULTS) as $field) {
            if (array_key_exists($field, $body)) {
                $data[$field] = ApiInput::boolean($body, $field);
            }
        }
        if ($data === []) {
            throw ApiInput::invalid('body', 'Select a preference', 'custom');
        }

        $userId = $request->attributes->get('authUser')->id;
        $initial = $data + self::DEFAULTS;
        $row = DB::transaction(function () use ($userId, $initial, $data) {
            // Writes the original columns only, so older enrollment-only schemas keep working.
            DB::statement(
                'INSERT INTO `PushPreference` (userId, messages, listingReviews, accountUpdates, updatedAt)
                 VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3))
                 ON DUPLICATE KEY UPDATE
                   messages = COALESCE(?, messages),
                   listingReviews = COALESCE(?, listingReviews),
                   accountUpdates = COALESCE(?, accountUpdates),
                   updatedAt = UTC_TIMESTAMP(3)',
                [$userId, (int) $initial['messages'], (int) $initial['listingReviews'], (int) $initial['accountUpdates'],
                    $this->nullableFlag($data, 'messages'), $this->nullableFlag($data, 'listingReviews'), $this->nullableFlag($data, 'accountUpdates')],
            );

            return PushPreference::query()->findOrFail($userId, ['messages', 'listingReviews', 'accountUpdates']);
        });

        return ApiResponse::json($row->toArray());
    }

    public function subscribe(Request $request): JsonResponse
    {
        if (! $this->policy->subscriptionsEnabled()) {
            throw new ApiError(503, 'push_not_configured');
        }

        $subscription = $this->subscriptionBody($request);
        if (! PushEndpoints::permitted($subscription['endpoint'])) {
            throw new ApiError(400, 'invalid_push_endpoint');
        }

        $hash = PushEndpoints::hash($subscription['endpoint']);
        $userId = $request->attributes->get('authUser')->id;
        for ($attempt = 1; ; $attempt++) {
            try {
                Tx::readCommitted(function () use ($userId, $hash, $subscription) {
                    // Locks the account row so concurrent enrollments cannot exceed the device limit.
                    $user = DB::selectOne('SELECT status FROM `User` WHERE id = ? FOR UPDATE', [$userId]);
                    if (($user->status ?? null) !== 'active') {
                        throw new ApiError(401, 'unauthenticated');
                    }

                    $now = Carbon::now('UTC')->format('Y-m-d H:i:s.v');
                    PushSubscription::query()->where('userId', $userId)->where('expiresAt', '<=', $now)->delete();
                    $existing = PushSubscription::query()->where('endpointHash', $hash)->first(['id', 'userId']);
                    if ($existing?->userId !== $userId && PushSubscription::query()->where('userId', $userId)->count() >= self::MAX_DEVICES) {
                        throw new ApiError(409, 'push_device_limit');
                    }

                    $data = ['userId' => $userId, 'endpoint' => $subscription['endpoint'], 'p256dh' => $subscription['p256dh'], 'auth' => $subscription['auth'], 'expiresAt' => $subscription['expiresAt']];
                    if ($existing !== null) {
                        PushSubscription::query()->whereKey($existing->id)->update($data);
                    } else {
                        PushSubscription::create($data + ['endpointHash' => $hash]);
                    }
                });
                break;
            } catch (QueryException $error) {
                $retryable = in_array((int) ($error->errorInfo[1] ?? 0), [1062, 1205, 1213], true);
                if (! $retryable || $attempt >= 3) {
                    throw $error;
                }
            }
        }

        return ApiResponse::json(['ok' => true], 201);
    }

    public function unsubscribe(Request $request): Response
    {
        $endpoint = $this->endpointBody($request);
        PushSubscription::query()->where('userId', $request->attributes->get('authUser')->id)->where('endpointHash', PushEndpoints::hash($endpoint))->delete();

        return response()->noContent();
    }

    private function endpointBody(Request $request): string
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['endpoint']);

        return $this->endpoint($body);
    }

    private function endpoint(array $body): string
    {
        $value = $body['endpoint'] ?? null;
        if (! ApiInput::url($value) || ApiInput::length($value) > 2048) {
            throw ApiInput::invalid('endpoint', 'Invalid url', 'invalid_string');
        }

        return $value;
    }

    private function subscriptionBody(Request $request): array
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['endpoint', 'keys', 'expirationTime']);
        $endpoint = $this->endpoint($body);
        $keys = $body['keys'] ?? null;
        if (! is_array($keys) || array_is_list($keys) && $keys !== []) {
            throw ApiInput::invalid('keys', 'Expected object');
        }
        ApiInput::strictKeys($keys, ['p256dh', 'auth']);
        if (! is_string($keys['p256dh'] ?? null) || preg_match('/^[A-Za-z0-9_-]{60,180}\z/', $keys['p256dh']) !== 1) {
            throw ApiInput::invalid('keys', 'Invalid p256dh key', 'invalid_string');
        }
        if (! is_string($keys['auth'] ?? null) || preg_match('/^[A-Za-z0-9_-]{12,90}\z/', $keys['auth']) !== 1) {
            throw ApiInput::invalid('keys', 'Invalid auth key', 'invalid_string');
        }

        $expiresAt = null;
        if (array_key_exists('expirationTime', $body) && $body['expirationTime'] !== null) {
            $milliseconds = ApiInput::integer($body, 'expirationTime');
            if ($milliseconds <= 0 || $milliseconds > 8640000000000000) {
                throw ApiInput::invalid('expirationTime', 'Invalid expiration time');
            }
            $expiresAt = Carbon::createFromTimestampMsUTC($milliseconds)->format('Y-m-d H:i:s.v');
        }

        return ['endpoint' => $endpoint, 'p256dh' => $keys['p256dh'], 'auth' => $keys['auth'], 'expiresAt' => $expiresAt];
    }

    private function nullableFlag(array $data, string $field): ?int
    {
        return array_key_exists($field, $data) ? (int) $data[$field] : null;
    }
}
