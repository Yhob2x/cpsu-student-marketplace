<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Campus;
use App\Models\Category;
use App\Models\GuidelineContent;
use App\Models\HomePageContent;
use App\Services\MediaStorage;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use App\Support\ManagedContent;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class CatalogController extends Controller
{
    public function campuses(): JsonResponse
    {
        return ApiResponse::json(Campus::query()->where('active', true)->orderBy('id')->get(['id', 'code', 'name'])->toArray());
    }

    public function categories(): JsonResponse
    {
        return ApiResponse::json(Category::query()->orderBy('id')->get(['id', 'parentId', 'name', 'listingType'])->toArray());
    }

    public function guidelines(): JsonResponse
    {
        $content = GuidelineContent::query()->whereKey(1)->first(['publishedBody', 'publishedAt']);

        return ApiResponse::json([
            'body' => $content?->publishedBody ?? ManagedContent::DEFAULT_GUIDELINES,
            'publishedAt' => ApiResponse::date($content?->publishedAt),
        ]);
    }

    public function announcements(): JsonResponse
    {
        $items = Announcement::query()->where('status', 'published')->orderByDesc('publishedAt')->limit(10)->get(['id', 'title', 'body', 'publishedAt']);

        return ApiResponse::json(['items' => $items->toArray()]);
    }

    public function homePage(): JsonResponse
    {
        $row = HomePageContent::query()->whereKey(1)->first(['published', 'publishedRevision']);
        $published = $row?->published ? ManagedContent::parseHomePage($row->published) : null;
        $view = $published !== null
            ? ManagedContent::publicHomePage($published, $row->publishedRevision)
            : ManagedContent::publicHomePage(ManagedContent::defaultHomePage(), 0);

        return ApiResponse::json($view, 200, ['Cache-Control' => 'no-store']);
    }

    public function homeImage(string $slot, MediaStorage $media): Response
    {
        if (! in_array($slot, ManagedContent::IMAGE_SLOTS, true)) {
            throw ApiInput::invalid('slot', 'Invalid enum value', 'invalid_enum_value');
        }

        $row = HomePageContent::query()->whereKey(1)->first(['published']);
        $published = $row?->published ? ManagedContent::parseHomePage($row->published) : null;
        $mediaPath = $published['images'][$slot] ?? null;
        if (! $mediaPath) {
            throw new ApiError(404, 'not_found');
        }

        return $media->response($mediaPath, 'image/webp');
    }
}
