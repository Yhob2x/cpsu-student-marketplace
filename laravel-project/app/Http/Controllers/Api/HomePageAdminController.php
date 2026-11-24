<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HomePageContent;
use App\Services\MediaStorage;
use App\Services\PhotoService;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ManagedContent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class HomePageAdminController extends Controller
{
    private const IMAGE_BASE = '/api/v1/admin/content/home-page/images';

    private const IMAGE_ERROR = 'Choose a JPEG, PNG or WebP image up to 3 MB.';

    public function __construct(
        private readonly MediaStorage $media,
        private readonly PhotoService $photos,
    ) {
    }

    public function show(): JsonResponse
    {
        return ApiResponse::json($this->view(HomePageContent::query()->find(1)), 200, ['Cache-Control' => 'private, no-store']);
    }

    public function saveCopy(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['copy', 'expectedRevision']);
        $copy = ManagedContent::parseCopy($body['copy'] ?? null) ?? throw ApiInput::invalid('copy', 'Invalid home page copy', 'custom');
        $revision = $this->revision($body, 'expectedRevision');
        [$row] = $this->saveDraft($revision, fn ($current) => ['copy' => $copy] + $current, $this->actor($request), 'home_page.draft_saved');

        return ApiResponse::json($this->view($row));
    }

    public function publish(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['expectedRevision']);
        $expected = $this->revision($body, 'expectedRevision');
        $actor = $this->actor($request);

        [$row, $previous] = DB::transaction(function () use ($expected, $actor) {
            $current = HomePageContent::query()->find(1);
            if ($current === null || $current->revision !== $expected) {
                throw new ApiError(409, 'draft_changed');
            }
            if ($current->publishedRevision === $expected) {
                throw new ApiError(409, 'already_published');
            }

            $draft = $this->snapshot($current->draft);
            $changed = HomePageContent::query()->whereKey(1)->where('revision', $expected)->where('publishedRevision', '!=', $expected)->update([
                'published' => json_encode($draft, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'publishedRevision' => $expected,
                'publishedAt' => ListingAccess::now(),
            ]);
            if ($changed !== 1) {
                throw new ApiError(409, 'draft_changed');
            }
            AuditLog::create(['actorUserId' => $actor, 'action' => 'home_page.published', 'targetType' => 'home_page_content', 'targetId' => 1, 'metadata' => ['revision' => $expected]]);

            return [HomePageContent::query()->findOrFail(1), $current->published ? $this->snapshot($current->published) : null];
        });

        $inUse = array_values($this->snapshot($row->draft)['images']);
        foreach ($previous['images'] ?? [] as $oldPath) {
            if ($oldPath && ! in_array($oldPath, $inUse, true)) {
                $this->media->deleteQuietly($oldPath);
            }
        }

        return ApiResponse::json($this->view($row));
    }

    public function image(string $slot): Response
    {
        $this->assertSlot($slot);
        $row = HomePageContent::query()->find(1, ['id', 'draft']);
        $mediaPath = $row ? $this->snapshot($row->draft)['images'][$slot] : null;
        if (! $mediaPath) {
            throw new ApiError(404, 'not_found');
        }

        return $this->media->response($mediaPath, 'image/webp');
    }

    public function uploadImage(Request $request, string $slot): JsonResponse
    {
        $this->assertSlot($slot);
        $files = $request->allFiles();
        $file = $files['image'] ?? null;
        if (count($files) !== 1 || ! $file instanceof UploadedFile || ! $file->isValid() || $file->getSize() > 3145728
            || ! in_array($file->getClientMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw new ApiError(400, 'invalid_image', self::IMAGE_ERROR);
        }

        $revision = $this->revision($request->post(), 'expectedRevision');
        $stored = $this->media->storeSanitized($this->photos->sanitize($file));
        try {
            [$row, $previous] = $this->saveDraft($revision, function ($current) use ($slot, $stored) {
                $current['images'][$slot] = $stored['mediaPath'];

                return $current;
            }, $this->actor($request), 'home_page.image_saved');
        } catch (Throwable $error) {
            $this->media->deleteQuietly($stored['mediaPath']);
            throw $error;
        }
        $this->cleanupReplaced($row, $previous['images'][$slot] ?? null);

        return ApiResponse::json($this->view($row));
    }

    public function removeImage(Request $request, string $slot): JsonResponse
    {
        $this->assertSlot($slot);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['expectedRevision']);
        $revision = $this->revision($body, 'expectedRevision');
        [$row, $previous] = $this->saveDraft($revision, function ($current) use ($slot) {
            $current['images'][$slot] = null;

            return $current;
        }, $this->actor($request), 'home_page.image_removed');
        $this->cleanupReplaced($row, $previous['images'][$slot] ?? null);

        return ApiResponse::json($this->view($row));
    }

    private function saveDraft(int $expected, callable $change, int $actor, string $action): array
    {
        return DB::transaction(function () use ($expected, $change, $actor, $action) {
            $current = HomePageContent::query()->find(1);
            if (($current?->revision ?? 0) !== $expected) {
                throw new ApiError(409, 'draft_changed');
            }

            $previous = $current ? $this->snapshot($current->draft) : ManagedContent::defaultHomePage();
            $next = $this->snapshot($change($previous));
            if ($current !== null) {
                $changed = HomePageContent::query()->whereKey(1)->where('revision', $expected)->update([
                    'draft' => json_encode($next, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                    'revision' => DB::raw('`revision` + 1'),
                ]);
                if ($changed !== 1) {
                    throw new ApiError(409, 'draft_changed');
                }
                $row = HomePageContent::query()->findOrFail(1);
            } else {
                try {
                    $row = HomePageContent::create(['id' => 1, 'draft' => $next, 'revision' => 1])->fresh();
                } catch (UniqueConstraintViolationException) {
                    throw new ApiError(409, 'draft_changed');
                }
            }
            AuditLog::create(['actorUserId' => $actor, 'action' => $action, 'targetType' => 'home_page_content', 'targetId' => 1, 'metadata' => ['revision' => $row->revision]]);

            return [$row, $previous];
        });
    }

    private function cleanupReplaced(HomePageContent $row, ?string $oldPath): void
    {
        if (! $oldPath) {
            return;
        }

        $published = $row->published ? $this->snapshot($row->published)['images'] : [];
        if (! in_array($oldPath, $this->snapshot($row->draft)['images'], true) && ! in_array($oldPath, $published, true)) {
            $this->media->deleteQuietly($oldPath);
        }
    }

    private function view(?HomePageContent $row): array
    {
        $draft = $row ? $this->snapshot($row->draft) : ManagedContent::defaultHomePage();
        $published = $row?->published ? $this->snapshot($row->published) : null;

        return [
            'draft' => ManagedContent::publicHomePage($draft, $row?->revision ?? 0, self::IMAGE_BASE),
            'published' => $published ? ManagedContent::publicHomePage($published, $row->publishedRevision) : null,
            'revision' => $row?->revision ?? 0,
            'publishedRevision' => $row?->publishedRevision ?? 0,
            'publishedAt' => ApiResponse::date($row?->publishedAt),
        ];
    }

    private function snapshot(mixed $value): array
    {
        return ManagedContent::parseHomePage($value) ?? throw ApiInput::invalid('body', 'Invalid home page content', 'custom');
    }

    private function revision(array $body, string $field): int
    {
        if (! array_key_exists($field, $body)) {
            throw ApiInput::invalid($field, 'Required');
        }

        $number = ApiInput::coerceNumber($body[$field]);
        if ($number === null || ! is_finite($number) || floor($number) !== $number || $number < 0) {
            throw ApiInput::invalid($field, 'Invalid revision');
        }

        return (int) $number;
    }

    private function assertSlot(string $slot): void
    {
        if (! in_array($slot, ManagedContent::IMAGE_SLOTS, true)) {
            throw ApiInput::invalid('slot', 'Invalid enum value', 'invalid_enum_value');
        }
    }

    private function actor(Request $request): int
    {
        return $request->attributes->get('authUser')->id;
    }
}
