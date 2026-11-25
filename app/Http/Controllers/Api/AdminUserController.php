<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\Notification;
use App\Models\Session;
use App\Models\User;
use App\Models\UserRole;
use App\Services\PasswordHasher;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\Permissions;
use App\Support\Tx;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminUserController extends Controller
{
    public function auditLogs(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        $limit = ApiQuery::int($input, 'limit', 25, 1, 50);
        $cursor = ApiQuery::int($input, 'cursor', null, 1);
        $items = AuditLog::query()->when($cursor, fn ($query) => $query->where('id', '<', $cursor))
            ->with('actor:id,displayName')->orderByDesc('id')->limit($limit)->get();

        return ApiResponse::json([
            'items' => $items->map(function ($row) {
                $raw = $row->getRawOriginal('metadata');

                return [
                    'id' => $row->id,
                    'actorUserId' => $row->actorUserId,
                    'action' => $row->action,
                    'targetType' => $row->targetType,
                    'targetId' => $row->targetId,
                    // Decoded as objects so an empty metadata {} is not returned as [].
                    'metadata' => $raw === null ? null : json_decode($raw),
                    'createdAt' => ApiResponse::date($row->createdAt),
                    'actor' => $row->actor ? ['displayName' => $row->actor->displayName] : null,
                ];
            })->all(),
            'nextCursor' => $items->count() === $limit ? $items->last()->id : null,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function users(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        $q = ApiQuery::trimmed($input, 'q', 80);
        $status = ApiQuery::enum($input, 'status', ['active', 'suspended']);
        $verification = ApiQuery::enum($input, 'verification', ['unverified', 'pending', 'verified', 'rejected', 'suspended']);
        $campusId = ApiQuery::int($input, 'campusId', null, 1);
        $page = ApiQuery::int($input, 'page', 1, 1, 10000);
        $pageSize = ApiQuery::int($input, 'pageSize', 25, 1, 50);

        $where = function () use ($q, $status, $verification, $campusId) {
            $query = User::query()->whereDoesntHave('roles', fn ($role) => $role->whereIn('role', Permissions::STAFF_ROLES));
            if ($q !== null && $q !== '') {
                $pattern = "%{$q}%";
                $query->where(fn ($match) => $match
                    ->where('displayName', 'like', $pattern)
                    ->orWhere('email', 'like', $pattern)
                    ->orWhereHas('sellerProfiles', fn ($store) => $store->where('storeName', 'like', $pattern)));
            }
            if ($status) {
                $query->where('status', $status);
            }
            if ($campusId || $verification) {
                $query->whereHas('affiliations', function ($affiliation) use ($campusId, $verification) {
                    if ($campusId) {
                        $affiliation->where('campusId', $campusId);
                    }
                    if ($verification) {
                        $affiliation->where('verificationStatus', $verification);
                    }
                });
            }

            return $query;
        };

        $items = $where()->with([
            'roles:userId,role',
            'affiliations' => fn ($affiliation) => $affiliation->orderBy('id'),
            'affiliations.campus:id,code',
            'sellerProfiles' => fn ($store) => $store->select(['id', 'ownerUserId', 'storeName'])->orderBy('id'),
        ])
            ->orderByDesc('id')->offset(($page - 1) * $pageSize)->limit($pageSize)->get(['id', 'displayName', 'email', 'status']);

        return ApiResponse::json([
            'items' => $items->map(fn ($user) => [
                'id' => $user->id,
                'displayName' => $user->displayName,
                'email' => $user->email,
                'status' => $user->status->value,
                'roles' => $user->roles->map(fn ($role) => ['role' => $role->role->value])->all(),
                'storeNames' => $user->sellerProfiles->pluck('storeName')->all(),
                'affiliations' => $user->affiliations->map(fn ($row) => [
                    'campus' => ['id' => $row->campus->id, 'code' => $row->campus->code],
                    'verificationStatus' => $row->verificationStatus->value,
                    'expirationAt' => ApiResponse::date($row->expirationAt),
                ])->all(),
            ])->all(),
            'total' => $where()->count(),
            'page' => $page,
            'pageSize' => $pageSize,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function assignReviewer(Request $request, string $id): JsonResponse
    {
        $targetId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['campusId', 'reason']);
        $campusId = ApiInput::positiveInteger($body, 'campusId');
        $reason = ApiInput::string($body, 'reason', 10, 500, true);
        $actor = $request->attributes->get('authUser')->id;
        if ($targetId === $actor) {
            throw new ApiError(409, 'self_role_change_forbidden');
        }

        try {
            Tx::serializable(function () use ($targetId, $campusId, $reason, $actor) {
                $target = User::query()->with('roles')->find($targetId);
                if ($target === null) {
                    throw new ApiError(404, 'not_found');
                }
                if ($target->status->value !== 'active') {
                    throw new ApiError(409, 'inactive_student');
                }
                if ($target->roles->isNotEmpty()) {
                    throw new ApiError(409, 'staff_account_protected');
                }
                if (! Campus::query()->whereKey($campusId)->where('active', true)->exists()) {
                    throw new ApiError(400, 'invalid_campus');
                }
                if (! ListingAccess::currentAffiliation(Affiliation::query()->where('userId', $targetId)->where('campusId', $campusId))->exists()) {
                    throw new ApiError(409, 'reviewer_affiliation_required');
                }

                UserRole::create(['userId' => $targetId, 'role' => 'campus_reviewer', 'campusId' => $campusId]);
                Session::query()->where('userId', $targetId)->whereNull('revokedAt')->update(['revokedAt' => ListingAccess::now()]);
                AuditLog::create(['actorUserId' => $actor, 'action' => 'reviewer.assigned', 'targetType' => 'user', 'targetId' => $targetId, 'metadata' => ['campusId' => $campusId, 'reason' => $reason]]);
            });
        } catch (QueryException $error) {
            if (in_array((int) ($error->errorInfo[1] ?? 0), [1205, 1213], true)) {
                throw new ApiError(409, 'reviewer_assignment_conflict');
            }
            throw $error;
        }

        return ApiResponse::json(['id' => $targetId, 'campusId' => $campusId, 'role' => 'campus_reviewer', 'sessionsRevoked' => true], 200, ['Cache-Control' => 'no-store']);
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $targetId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        $status = ApiInput::enum($body, 'status', ['active', 'suspended']);
        $reason = ApiInput::string($body, 'reason', 10, 500, true);
        $actor = $request->attributes->get('authUser')->id;

        $target = User::query()->with('roles')->find($targetId);
        if ($target === null) {
            throw new ApiError(404, 'not_found');
        }
        if ($target->id === $actor) {
            throw new ApiError(409, 'self_status_change_forbidden');
        }
        if ($target->roles->contains(fn ($role) => in_array($role->role->value, Permissions::STAFF_ROLES, true))) {
            throw new ApiError(403, 'staff_account_protected');
        }
        if ($target->status->value === $status) {
            throw new ApiError(409, 'unchanged_status');
        }

        DB::transaction(function () use ($targetId, $target, $status, $reason, $actor) {
            if (User::query()->whereKey($targetId)->where('status', $target->status->value)->update(['status' => $status]) !== 1) {
                throw new ApiError(409, 'status_changed');
            }
            if ($status === 'suspended') {
                Session::query()->where('userId', $targetId)->whereNull('revokedAt')->update(['revokedAt' => ListingAccess::now()]);
            }
            AuditLog::create([
                'actorUserId' => $actor, 'action' => $status === 'suspended' ? 'user.suspended' : 'user.reactivated',
                'targetType' => 'user', 'targetId' => $targetId, 'metadata' => ['reason' => $reason],
            ]);
            Notification::create(['userId' => $targetId, 'type' => 'account.status', 'payload' => ['status' => $status]]);
        });

        return ApiResponse::json(['id' => $targetId, 'status' => $status], 200, ['Cache-Control' => 'no-store']);
    }

    public function reviewers(Request $request): JsonResponse
    {
        $input = ApiQuery::all($request);
        ApiQuery::strictKeys($input, ['q', 'page', 'pageSize']);
        $q = ApiQuery::trimmed($input, 'q', 80) ?? '';
        $page = ApiQuery::int($input, 'page', 1, 1, 10000);
        $pageSize = ApiQuery::int($input, 'pageSize', 25, 1, 50);

        $where = function () use ($q) {
            $query = User::query()->whereHas('roles', fn ($role) => $role->where('role', 'campus_reviewer'))
                ->whereDoesntHave('roles', fn ($role) => $role->whereIn('role', ['university_admin', 'system_admin', 'establishment']));
            if ($q !== '') {
                $query->where(fn ($match) => $match->where('displayName', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"));
            }

            return $query;
        };

        $items = $where()->with(['roles' => fn ($role) => $role->where('role', 'campus_reviewer')->orderBy('id'), 'roles.campus:id,name,code'])
            ->withCount('affiliations')->orderByDesc('id')->offset(($page - 1) * $pageSize)->limit($pageSize)->get(['id', 'displayName', 'email', 'status']);

        return ApiResponse::json([
            'items' => $items->map(fn ($user) => [
                'id' => $user->id,
                'displayName' => $user->displayName,
                'email' => $user->email,
                'status' => $user->status->value,
                'roles' => $user->roles->map(fn ($role) => [
                    'role' => $role->role->value,
                    'campusId' => $role->campusId,
                    'campus' => $role->campus ? ['id' => $role->campus->id, 'name' => $role->campus->name, 'code' => $role->campus->code] : null,
                ])->all(),
                '_count' => ['affiliations' => (int) $user->affiliations_count],
            ])->all(),
            'total' => $where()->count(),
            'page' => $page,
            'pageSize' => $pageSize,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function createReviewer(Request $request, PasswordHasher $passwords): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['email', 'displayName', 'password', 'campusId']);
        $email = $this->reviewerEmail($body);
        $displayName = ApiInput::string($body, 'displayName', 2, 80, true);
        $password = ApiInput::string($body, 'password', 12, 128);
        $campusId = ApiInput::positiveInteger($body, 'campusId');
        if (! Campus::query()->whereKey($campusId)->where('active', true)->exists()) {
            throw new ApiError(400, 'invalid_campus');
        }
        $hash = $passwords->hash($password);
        $actor = $request->attributes->get('authUser')->id;

        try {
            $user = DB::transaction(function () use ($email, $displayName, $hash, $campusId, $actor) {
                $user = User::create(['email' => $email, 'displayName' => $displayName, 'passwordHash' => $hash]);
                UserRole::create(['userId' => $user->id, 'role' => 'campus_reviewer', 'campusId' => $campusId]);
                AuditLog::create(['actorUserId' => $actor, 'action' => 'reviewer.created', 'targetType' => 'user', 'targetId' => $user->id, 'metadata' => ['campusId' => $campusId]]);

                return $user->fresh();
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiError(409, 'email_taken');
        }

        return ApiResponse::json(['id' => $user->id, 'email' => $user->email, 'displayName' => $user->displayName, 'status' => $user->status->value, 'campusId' => $campusId], 201, ['Cache-Control' => 'no-store']);
    }

    public function updateReviewer(Request $request, string $id, PasswordHasher $passwords): JsonResponse
    {
        $targetId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['email', 'displayName', 'password', 'campusId', 'status', 'reason']);
        $changes = [];
        if (array_key_exists('email', $body)) {
            $changes['email'] = $this->reviewerEmail($body);
        }
        if (array_key_exists('displayName', $body)) {
            $changes['displayName'] = ApiInput::string($body, 'displayName', 2, 80, true);
        }
        if (array_key_exists('password', $body)) {
            $changes['password'] = ApiInput::string($body, 'password', 12, 128);
        }
        if (array_key_exists('campusId', $body)) {
            $changes['campusId'] = ApiInput::positiveInteger($body, 'campusId');
        }
        if (array_key_exists('status', $body)) {
            $changes['status'] = ApiInput::enum($body, 'status', ['active', 'suspended']);
        }
        $reason = ApiInput::string($body, 'reason', 10, 500, true);
        if ($changes === []) {
            throw ApiInput::invalid('body', 'At least one reviewer detail must change.', 'custom');
        }

        $target = User::query()->with('roles')->find($targetId);
        if ($target === null || $this->manageableRole($target->roles) === null) {
            throw new ApiError(404, 'not_found');
        }
        if (isset($changes['campusId']) && ! Campus::query()->whereKey($changes['campusId'])->where('active', true)->exists()) {
            throw new ApiError(400, 'invalid_campus');
        }

        $hash = isset($changes['password']) && $changes['password'] !== '' ? $passwords->hash($changes['password']) : null;
        $revoke = (bool) array_intersect(['password', 'email', 'campusId', 'status'], array_keys($changes));
        $actor = $request->attributes->get('authUser')->id;

        try {
            DB::transaction(function () use ($targetId, $changes, $hash, $revoke, $reason, $actor) {
                $role = $this->manageableRole(UserRole::query()->where('userId', $targetId)->get());
                if ($role === null) {
                    throw new ApiError(404, 'not_found');
                }

                $userData = array_intersect_key($changes, array_flip(['email', 'displayName', 'status']));
                if ($hash !== null) {
                    $userData['passwordHash'] = $hash;
                }
                if ($userData !== []) {
                    User::query()->whereKey($targetId)->update($userData);
                }
                if (isset($changes['campusId'])) {
                    $query = UserRole::query()->whereKey($role->id)->where('userId', $targetId)->where('role', 'campus_reviewer');
                    $role->campusId === null ? $query->whereNull('campusId') : $query->where('campusId', $role->campusId);
                    if ($query->update(['campusId' => $changes['campusId']]) !== 1) {
                        throw new ApiError(409, 'reviewer_scope_changed');
                    }
                }
                if ($revoke) {
                    Session::query()->where('userId', $targetId)->whereNull('revokedAt')->update(['revokedAt' => ListingAccess::now()]);
                }
                AuditLog::create([
                    'actorUserId' => $actor, 'action' => 'reviewer.updated', 'targetType' => 'user', 'targetId' => $targetId,
                    'metadata' => ['reason' => $reason, 'fields' => array_keys($changes)] + (isset($changes['campusId']) ? ['campusId' => $changes['campusId']] : []),
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiError(409, 'email_taken');
        }

        return ApiResponse::json(['id' => $targetId, 'updated' => true, 'sessionsRevoked' => $revoke], 200, ['Cache-Control' => 'no-store']);
    }

    private function reviewerEmail(array $body): string
    {
        $value = $body['email'] ?? null;
        if (! is_string($value)) {
            throw ApiInput::invalid('email', 'Invalid email', 'invalid_string');
        }

        $email = ApiInput::email(['email' => ApiInput::trim($value)]);
        if (ApiInput::length($email) > 191) {
            throw ApiInput::invalid('email', 'Email is too long', 'too_big');
        }

        return $email;
    }

    private function manageableRole($roles): ?UserRole
    {
        return $roles->count() === 1 && $roles->first()->role->value === 'campus_reviewer' ? $roles->first() : null;
    }
}
