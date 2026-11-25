<?php

namespace App\Support;

/** Pure authorization rules ported from apps/api/src/permissions.ts. */
final class Permissions
{
    public const STAFF_ROLES = ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'];

    private const MATERIAL_FIELDS = ['title', 'description', 'categoryId', 'type', 'campusId', 'condition'];

    public static function isStaffAccount(array $roles): bool
    {
        foreach ($roles as $role) {
            if (in_array($role['role'], self::STAFF_ROLES, true)) {
                return true;
            }
        }

        return false;
    }

    public static function canManageCatalog(AuthUser $user): bool
    {
        foreach ($user->roles as $role) {
            if ($role['role'] === 'university_admin' && $role['campusId'] === null) {
                return true;
            }
        }

        return false;
    }

    /** System administrators deliberately cannot approve listings. */
    public static function canReview(AuthUser $user, int $campusId): bool
    {
        foreach ($user->roles as $role) {
            if ($role['role'] === 'campus_reviewer' && $role['campusId'] === $campusId) {
                return true;
            }
            if ($role['role'] === 'university_admin' && ($role['campusId'] === null || $role['campusId'] === $campusId)) {
                return true;
            }
        }

        return false;
    }

    /** @return list<int>|'all' */
    public static function reviewCampusIds(AuthUser $user): array|string
    {
        if (self::canManageCatalog($user)) {
            return 'all';
        }

        $campuses = [];
        foreach ($user->roles as $role) {
            if ($role['campusId'] !== null && in_array($role['role'], ['campus_reviewer', 'university_admin'], true)) {
                $campuses[] = $role['campusId'];
            }
        }

        return $campuses;
    }

    public static function isMaterialChange(array $patch, ?array $current = null): bool
    {
        foreach (self::MATERIAL_FIELDS as $field) {
            if (array_key_exists($field, $patch) && ($current === null || ($patch[$field] ?? null) !== ($current[$field] ?? null))) {
                return true;
            }
        }

        return false;
    }
}
