<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\GuidelineContent;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\ManagedContent;
use App\Support\PublicReadCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminContentController extends Controller
{
    public function guidelines(): JsonResponse
    {
        $content = GuidelineContent::query()->find(1);

        return ApiResponse::json($content?->toArray() ?? ['id' => 1, 'draftBody' => ManagedContent::DEFAULT_GUIDELINES, 'publishedBody' => null, 'publishedAt' => null]);
    }

    public function saveGuidelines(Request $request): JsonResponse
    {
        $body = ManagedContent::plainInput(ApiInput::object($request), 'body', 10000);
        $content = GuidelineContent::query()->find(1) ?? new GuidelineContent(['id' => 1]);
        $content->draftBody = $body;
        $content->updatedAt = now();
        $content->save();
        $this->audit($request, 'guidelines.draft_saved', 'guidelines', 1);

        return ApiResponse::json($content->fresh()->toArray());
    }

    public function publishGuidelines(Request $request): JsonResponse
    {
        $expected = ManagedContent::plainInput(ApiInput::object($request), 'expectedBody', 10000);
        $current = GuidelineContent::query()->find(1);
        if ($current === null) {
            throw new ApiError(409, 'no_draft');
        }
        if ($current->draftBody !== $expected) {
            throw new ApiError(409, 'draft_changed');
        }

        $changed = GuidelineContent::query()->whereKey(1)->where('draftBody', $expected)->update(['publishedBody' => $expected, 'publishedAt' => ListingAccess::now()]);
        if ($changed !== 1) {
            throw new ApiError(409, 'draft_changed');
        }
        PublicReadCache::forget(PublicReadCache::GUIDELINES);
        $this->audit($request, 'guidelines.published', 'guidelines', 1);

        return ApiResponse::json(GuidelineContent::query()->findOrFail(1)->toArray());
    }

    public function announcements(): JsonResponse
    {
        return ApiResponse::json(['items' => Announcement::query()->orderByDesc('id')->limit(50)->get()->toArray()]);
    }

    public function createAnnouncement(Request $request): JsonResponse
    {
        $item = Announcement::create($this->announcementInput($request));
        $this->audit($request, 'announcement.created', 'announcement', $item->id);

        return ApiResponse::json($item->fresh()->toArray(), 201);
    }

    public function updateAnnouncement(Request $request, string $id): JsonResponse
    {
        $announcementId = ApiInput::positiveId($id);
        $data = $this->announcementInput($request);
        $current = $this->editable($announcementId);
        $change = $current->status->value === 'published' ? ['pendingTitle' => $data['title'], 'pendingBody' => $data['body']] : $data;
        Announcement::query()->whereKey($announcementId)->update($change);
        $this->audit($request, 'announcement.draft_saved', 'announcement', $announcementId);

        return ApiResponse::json(Announcement::query()->findOrFail($announcementId)->toArray());
    }

    public function publishAnnouncement(Request $request, string $id): JsonResponse
    {
        $announcementId = ApiInput::positiveId($id);
        $body = ApiInput::object($request);
        $title = ManagedContent::plainInput($body, 'expectedTitle', 120);
        $text = ManagedContent::plainInput($body, 'expectedBody', 2000);
        $current = $this->editable($announcementId);
        if (($current->pendingTitle ?? $current->title) !== $title || ($current->pendingBody ?? $current->body) !== $text) {
            throw new ApiError(409, 'draft_changed');
        }

        $query = Announcement::query()->whereKey($announcementId)->where('status', $current->status->value);
        if ($current->status->value === 'published') {
            foreach (['pendingTitle', 'pendingBody'] as $field) {
                $current->{$field} === null ? $query->whereNull($field) : $query->where($field, $current->{$field});
            }
        } else {
            $query->where('title', $current->title)->where('body', $current->body);
        }
        $changed = $query->update(['title' => $title, 'body' => $text, 'pendingTitle' => null, 'pendingBody' => null, 'status' => 'published', 'publishedAt' => ListingAccess::now()]);
        if ($changed !== 1) {
            throw new ApiError(409, 'draft_changed');
        }
        PublicReadCache::forget(PublicReadCache::ANNOUNCEMENTS);
        $this->audit($request, 'announcement.published', 'announcement', $announcementId);

        return ApiResponse::json(Announcement::query()->findOrFail($announcementId)->toArray());
    }

    public function archiveAnnouncement(Request $request, string $id): JsonResponse
    {
        $announcementId = ApiInput::positiveId($id);
        $this->editable($announcementId);
        Announcement::query()->whereKey($announcementId)->update(['status' => 'archived']);
        PublicReadCache::forget(PublicReadCache::ANNOUNCEMENTS);
        $this->audit($request, 'announcement.archived', 'announcement', $announcementId);

        return ApiResponse::json(Announcement::query()->findOrFail($announcementId)->toArray());
    }

    private function editable(int $id): Announcement
    {
        $current = Announcement::query()->find($id);
        if ($current === null) {
            throw new ApiError(404, 'not_found');
        }
        if ($current->status->value === 'archived') {
            throw new ApiError(409, 'archived');
        }

        return $current;
    }

    private function announcementInput(Request $request): array
    {
        $body = ApiInput::object($request);

        return ['title' => ManagedContent::plainInput($body, 'title', 120), 'body' => ManagedContent::plainInput($body, 'body', 2000)];
    }

    private function audit(Request $request, string $action, string $type, int $id): void
    {
        AuditLog::create(['actorUserId' => $request->attributes->get('authUser')->id, 'action' => $action, 'targetType' => $type, 'targetId' => $id]);
    }
}
