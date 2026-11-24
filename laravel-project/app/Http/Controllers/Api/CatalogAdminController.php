<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\Category;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** University-wide campus and category catalog. Campus reviewers cannot change it. */
class CatalogAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $campuses = Campus::query()->withCount(['affiliations', 'listings', 'campusRoles'])->orderByDesc('active')->orderBy('name')->get();
        $categories = Category::query()->withCount(['listings', 'children'])->orderBy('listingType')->orderBy('name')->get();

        return ApiResponse::json([
            'campuses' => $campuses->map(fn ($campus) => [
                'id' => $campus->id, 'code' => $campus->code, 'name' => $campus->name, 'active' => $campus->active,
                '_count' => ['affiliations' => (int) $campus->affiliations_count, 'listings' => (int) $campus->listings_count, 'campusRoles' => (int) $campus->campus_roles_count],
            ])->all(),
            'categories' => $categories->map(fn ($category) => [
                'id' => $category->id, 'name' => $category->name, 'listingType' => $category->listingType->value, 'parentId' => $category->parentId,
                '_count' => ['listings' => (int) $category->listings_count, 'children' => (int) $category->children_count],
            ])->all(),
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function createCampus(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['code', 'name']);
        $code = $this->campusCode($body);
        $name = ApiInput::string($body, 'name', 2, 100, true);
        $actor = $this->actor($request);

        try {
            $campus = DB::transaction(function () use ($code, $name, $actor) {
                if (Campus::query()->where('code', $code)->exists()) {
                    throw new ApiError(409, 'catalog_duplicate');
                }
                $campus = Campus::create(['code' => $code, 'name' => $name]);
                $this->audit($actor, 'campus.created', 'campus', $campus->id, ['code' => $campus->code, 'name' => $campus->name]);

                return $campus->fresh();
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiError(409, 'catalog_duplicate');
        }

        return ApiResponse::json($campus->toArray(), 201);
    }

    public function updateCampus(Request $request, string $id): JsonResponse
    {
        $campusId = $this->safeId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['code', 'name', 'active', 'confirmImpact']);
        $change = [];
        if (array_key_exists('code', $body)) {
            $change['code'] = $this->campusCode($body);
        }
        if (array_key_exists('name', $body)) {
            $change['name'] = ApiInput::string($body, 'name', 2, 100, true);
        }
        if (array_key_exists('active', $body)) {
            $change['active'] = ApiInput::boolean($body, 'active');
        }
        $confirmImpact = array_key_exists('confirmImpact', $body) ? ApiInput::boolean($body, 'confirmImpact') : false;
        if ($change === []) {
            throw ApiInput::invalid('body', 'No changes supplied', 'custom');
        }
        $actor = $this->actor($request);

        try {
            $campus = DB::transaction(function () use ($campusId, $change, $confirmImpact, $actor) {
                $current = Campus::query()->withCount(['affiliations', 'listings', 'campusRoles'])->find($campusId);
                if ($current === null) {
                    throw new ApiError(404, 'not_found');
                }
                if (isset($change['code']) && $change['code'] !== $current->code && Campus::query()->where('code', $change['code'])->exists()) {
                    throw new ApiError(409, 'catalog_duplicate');
                }
                $linked = $current->affiliations_count + $current->listings_count + $current->campus_roles_count;
                if (($change['active'] ?? null) === false && $current->active && $linked > 0 && ! $confirmImpact) {
                    throw new ApiError(409, 'campus_in_use');
                }

                $before = ['code' => $current->code, 'name' => $current->name, 'active' => $current->active];
                Campus::query()->whereKey($campusId)->update($change);
                $updated = Campus::query()->findOrFail($campusId);
                $this->audit($actor, 'campus.updated', 'campus', $campusId, ['before' => $before, 'after' => ['code' => $updated->code, 'name' => $updated->name, 'active' => $updated->active]]);

                return $updated;
            });
        } catch (UniqueConstraintViolationException) {
            throw new ApiError(409, 'catalog_duplicate');
        }

        return ApiResponse::json($campus->toArray());
    }

    public function createService(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['name']);
        $name = ApiInput::string($body, 'name', 2, 80, true);
        $actor = $this->actor($request);

        $category = DB::transaction(function () use ($name, $actor) {
            if (Category::query()->where('name', $name)->where('listingType', 'service')->exists()) {
                throw new ApiError(409, 'catalog_duplicate');
            }
            $category = Category::create(['name' => $name, 'listingType' => 'service']);
            $this->audit($actor, 'service_category.created', 'category', $category->id, ['name' => $category->name]);

            return $category->fresh();
        });

        return ApiResponse::json($category->toArray(), 201);
    }

    public function updateService(Request $request, string $id): JsonResponse
    {
        $categoryId = $this->safeId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['name']);
        $name = ApiInput::string($body, 'name', 2, 80, true);
        $actor = $this->actor($request);

        $category = DB::transaction(function () use ($categoryId, $name, $actor) {
            $current = Category::query()->whereKey($categoryId)->where('listingType', 'service')->first();
            if ($current === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($name !== $current->name && Category::query()->where('name', $name)->where('listingType', 'service')->where('id', '!=', $categoryId)->exists()) {
                throw new ApiError(409, 'catalog_duplicate');
            }
            $before = $current->name;
            Category::query()->whereKey($categoryId)->update(['name' => $name]);
            $updated = Category::query()->findOrFail($categoryId);
            $this->audit($actor, 'service_category.updated', 'category', $categoryId, ['before' => $before, 'after' => $updated->name]);

            return $updated;
        });

        return ApiResponse::json($category->toArray());
    }

    public function createCategory(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['name', 'listingType']);
        $name = ApiInput::string($body, 'name', 2, 80, true);
        $type = ApiInput::enum($body, 'listingType', ['physical_product', 'service']);
        $actor = $this->actor($request);

        $category = DB::transaction(function () use ($name, $type, $actor) {
            if (Category::query()->where('name', $name)->where('listingType', $type)->exists()) {
                throw new ApiError(409, 'catalog_duplicate');
            }
            $created = Category::create(['name' => $name, 'listingType' => $type]);
            $this->audit($actor, 'category.created', 'category', $created->id, ['name' => $created->name, 'listingType' => $type]);

            return $created->fresh();
        });

        return ApiResponse::json($category->toArray(), 201);
    }

    /** The category type is fixed after creation so current listings cannot change kind. */
    public function updateCategory(Request $request, string $id): JsonResponse
    {
        $categoryId = $this->safeId($id);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['name']);
        $name = ApiInput::string($body, 'name', 2, 80, true);
        $actor = $this->actor($request);

        $category = DB::transaction(function () use ($categoryId, $name, $actor) {
            $current = Category::query()->find($categoryId);
            if ($current === null) {
                throw new ApiError(404, 'not_found');
            }
            $type = $current->listingType->value;
            if ($name !== $current->name && Category::query()->where('name', $name)->where('listingType', $type)->where('id', '!=', $categoryId)->exists()) {
                throw new ApiError(409, 'catalog_duplicate');
            }
            $before = $current->name;
            Category::query()->whereKey($categoryId)->update(['name' => $name]);
            $updated = Category::query()->findOrFail($categoryId);
            $this->audit($actor, 'category.updated', 'category', $categoryId, ['before' => $before, 'after' => $updated->name, 'listingType' => $type]);

            return $updated;
        });

        return ApiResponse::json($category->toArray());
    }

    private function campusCode(array $body): string
    {
        $code = ApiInput::string($body, 'code', 2, 24, true);
        if (preg_match('/^[a-zA-Z0-9_-]+\z/', $code) !== 1) {
            throw ApiInput::invalid('code', 'Invalid campus code', 'invalid_string');
        }

        return strtoupper($code);
    }

    private function safeId(string $id): int
    {
        $number = ApiInput::jsNumber($id);
        if ($number === null || ! is_finite($number) || floor($number) !== $number || $number <= 0 || $number > 9007199254740991) {
            throw new ApiError(400, 'invalid_id');
        }

        return (int) $number;
    }

    private function actor(Request $request): int
    {
        return $request->attributes->get('authUser')->id;
    }

    private function audit(int $actor, string $action, string $type, int $id, array $metadata): void
    {
        AuditLog::create(['actorUserId' => $actor, 'action' => $action, 'targetType' => $type, 'targetId' => $id, 'metadata' => $metadata]);
    }
}
