<?php

namespace Tests\Feature\Api;

use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\Category;
use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\ListingMedia;
use App\Models\SellerProfile;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AccessTokens;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class ListingsAndUploadsApiTest extends TestCase
{
    private const WEBP = "RIFF\x10\0\0\0WEBPVP8 test-image";

    private string $uploads;

    private Campus $campus;

    private Category $category;

    private User $seller;

    private User $buyer;

    private SellerProfile $store;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new RuntimeException('Refusing to run: tests must target the disposable database.');
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['ListingAppreciation', 'ListingViewDedup', 'ListingViewCounter', 'StoreFollow', 'ListingMedia', 'ListingInventory', 'AuditLog', 'Notification', 'SavedListing', 'Listing', 'SellerProfile', 'Affiliation', 'UserRole', 'Session', 'User', 'Category', 'Campus'] as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->uploads = sys_get_temp_dir().DIRECTORY_SEPARATOR.'cpsu-laravel-test-'.bin2hex(random_bytes(6));
        mkdir($this->uploads, 0700, true);
        config([
            'marketplace.upload_dir' => $this->uploads,
            'marketplace.media_storage' => 'local',
            'marketplace.photo_service.url' => 'http://photo.test',
            'marketplace.photo_service.token' => 'test-only-photo-service-token-0123456789',
        ]);

        $this->campus = Campus::create(['code' => 'MAIN', 'name' => 'Main Campus', 'active' => true]);
        $this->category = Category::create(['name' => 'Pre-loved', 'listingType' => 'physical_product', 'policyRiskLevel' => 0]);
        $this->seller = $this->student('seller@example.test');
        $this->buyer = $this->student('buyer@example.test');
        $this->store = SellerProfile::create(['ownerUserId' => $this->seller->id, 'campusId' => $this->campus->id, 'storeName' => 'Test Store', 'description' => 'A store for tests', 'sellerType' => 'student', 'approvalStatus' => 'approved']);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->uploads);
        parent::tearDown();
    }

    private function student(string $email): User
    {
        $user = User::create(['email' => $email, 'displayName' => 'Student', 'passwordHash' => 'not-a-login']);
        Affiliation::create(['userId' => $user->id, 'campusId' => $this->campus->id, 'verificationStatus' => 'verified', 'verifiedAt' => now()]);

        return $user;
    }

    private function listing(string $status = 'published', int $stock = 2): Listing
    {
        $listing = Listing::create([
            'sellerProfileId' => $this->store->id, 'campusId' => $this->campus->id, 'categoryId' => $this->category->id, 'type' => 'physical_product',
            'title' => 'Test item', 'description' => 'A useful item for students', 'price' => '100.50', 'condition' => 'good', 'status' => $status,
        ]);
        ListingInventory::create(['listingId' => $listing->id, 'availableQuantity' => $stock]);

        return $listing->fresh();
    }

    private function photo(Listing $listing): ListingMedia
    {
        $name = bin2hex(random_bytes(16)).'.webp';
        file_put_contents($this->uploads.DIRECTORY_SEPARATOR.$name, self::WEBP);

        return ListingMedia::create(['listingId' => $listing->id, 'mediaPath' => $name, 'mimeType' => 'image/webp', 'position' => 0]);
    }

    private function as(User $user): static
    {
        return $this->withToken(app(AccessTokens::class)->sign($user->id));
    }

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('photo.png', 'untrusted-bytes')->mimeType('image/png');
    }

    private function fakePhotoService(string $verdict = 'safe'): void
    {
        Http::fake([
            'photo.test/sanitize*' => Http::response(self::WEBP, 200, ['Content-Type' => 'image/webp']),
            'photo.test/screen' => Http::response(['verdict' => $verdict]),
        ]);
    }

    private function storedFiles(): array
    {
        return array_values(array_diff(scandir($this->uploads), ['.', '..']));
    }

    public function test_unpublished_listings_are_visible_only_to_owner_and_campus_reviewer(): void
    {
        $draft = $this->listing('draft');
        $reviewer = User::create(['email' => 'reviewer@example.test', 'displayName' => 'Reviewer', 'passwordHash' => 'x']);
        UserRole::create(['userId' => $reviewer->id, 'role' => 'campus_reviewer', 'campusId' => $this->campus->id]);
        $system = User::create(['email' => 'system@example.test', 'displayName' => 'System', 'passwordHash' => 'x']);
        UserRole::create(['userId' => $system->id, 'role' => 'system_admin', 'campusId' => null]);

        $this->getJson("/api/v1/listings/{$draft->id}")->assertNotFound();
        $this->as($this->buyer)->getJson("/api/v1/listings/{$draft->id}")->assertNotFound();
        $this->as($system)->getJson("/api/v1/listings/{$draft->id}")->assertNotFound();
        $this->as($this->seller)->getJson("/api/v1/listings/{$draft->id}")->assertOk()->assertJsonPath('status', 'draft');
        $this->as($reviewer)->getJson("/api/v1/listings/{$draft->id}")->assertOk()->assertJsonPath('status', 'draft');
        $this->getJson('/api/v1/listings')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_store_of_suspended_owner_disappears_from_public_results(): void
    {
        $listing = $this->listing();
        $this->getJson('/api/v1/listings')->assertJsonPath('total', 1)->assertJsonPath('items.0.price', 100.5);

        User::whereKey($this->seller->id)->update(['status' => 'suspended']);

        $this->getJson('/api/v1/listings')->assertJsonPath('total', 0);
        $this->getJson("/api/v1/listings/{$listing->id}")->assertNotFound();
        $this->getJson("/api/v1/seller-profiles/{$this->store->id}")->assertNotFound();
    }

    public function test_private_photos_are_never_publicly_cacheable_or_exposed(): void
    {
        $published = $this->photo($this->listing());
        $draft = $this->photo($this->listing('draft'));

        $response = $this->get("/api/v1/media/{$published->id}")->assertOk();
        $cache = (string) $response->headers->get('Cache-Control');
        $this->assertStringContainsString('no-store', $cache);
        $this->assertStringContainsString('private', $cache);
        $this->assertStringNotContainsString('public', $cache);
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));

        $this->get("/api/v1/media/{$draft->id}")->assertNotFound();
        $this->as($this->buyer)->get("/api/v1/media/{$draft->id}")->assertNotFound();
        $this->as($this->seller)->get("/api/v1/media/{$draft->id}")->assertOk();
    }

    public function test_stored_media_paths_cannot_escape_the_upload_folder(): void
    {
        $listing = $this->listing();
        $media = ListingMedia::create(['listingId' => $listing->id, 'mediaPath' => '../../.env', 'mimeType' => 'image/webp', 'position' => 0]);

        $this->get("/api/v1/media/{$media->id}")->assertNotFound();
    }

    public function test_seller_routes_require_a_student_owner(): void
    {
        $listing = $this->listing();
        $staff = User::create(['email' => 'admin@example.test', 'displayName' => 'Admin', 'passwordHash' => 'x']);
        UserRole::create(['userId' => $staff->id, 'role' => 'university_admin', 'campusId' => null]);

        $this->getJson('/api/v1/seller/listings')->assertUnauthorized();
        $this->as($staff)->getJson('/api/v1/seller/listings')->assertForbidden()->assertJsonPath('error.code', 'student_account_required');
        $this->as($this->buyer)->patchJson("/api/v1/seller/listings/{$listing->id}", ['title' => 'Stolen title'])->assertNotFound();
        $this->as($this->buyer)->deleteJson("/api/v1/seller/listings/{$listing->id}")->assertNotFound();
        $this->assertSame('Test item', $listing->fresh()->title);
        $this->assertNull($listing->fresh()->deletedAt);
    }

    public function test_seller_without_a_store_receives_json_null(): void
    {
        $this->as($this->buyer)->get('/api/v1/seller/store')->assertOk()->assertContent('null');
    }

    public function test_unchanged_conditional_update_is_not_reported_as_a_conflict(): void
    {
        $listing = $this->listing();

        $this->as($this->seller)->patchJson("/api/v1/seller/listings/{$listing->id}", ['stockQuantity' => 2])
            ->assertOk()->assertJsonPath('stockQuantity', 2)->assertJsonPath('status', 'published');
    }

    public function test_material_edit_returns_published_listing_to_draft_but_stock_does_not(): void
    {
        $listing = $this->listing();

        $this->as($this->seller)->patchJson("/api/v1/seller/listings/{$listing->id}", ['stockQuantity' => 7])->assertJsonPath('status', 'published');
        $this->as($this->seller)->patchJson("/api/v1/seller/listings/{$listing->id}", ['title' => 'A changed title'])->assertJsonPath('status', 'draft');
    }

    public function test_new_photo_on_published_listing_requires_review_and_is_audited(): void
    {
        $this->fakePhotoService();
        $listing = $this->listing();

        $response = $this->as($this->seller)->post("/api/v1/seller/listings/{$listing->id}/media", ['image' => $this->image()])->assertCreated();

        $this->assertSame('draft', $listing->fresh()->status->value);
        $this->assertCount(1, $this->storedFiles());
        $this->assertSame('image/webp', ListingMedia::findOrFail($response->json('id'))->mimeType);
        $this->assertTrue(AuditLog::where('action', 'listing.photo_added')->where('targetId', $listing->id)->exists());
        Http::assertSent(fn ($request) => $request->hasHeader('X-Photo-Service-Token', 'test-only-photo-service-token-0123456789'));
    }

    public function test_photo_limit_is_enforced_before_processing(): void
    {
        $this->fakePhotoService();
        $listing = $this->listing('draft');
        foreach (range(1, 5) as $_) {
            $this->photo($listing);
        }

        $this->as($this->seller)->post("/api/v1/seller/listings/{$listing->id}/media", ['image' => $this->image()])
            ->assertStatus(409)->assertJsonPath('error.code', 'too_many_images');
        Http::assertNothingSent();
    }

    public function test_listing_upload_fails_cleanly_when_photo_service_is_down(): void
    {
        Http::fake(fn () => throw new ConnectionException('down'));
        $listing = $this->listing('draft');

        $this->as($this->seller)->post("/api/v1/seller/listings/{$listing->id}/media", ['image' => $this->image()])
            ->assertStatus(503)->assertJsonPath('error.code', 'photo_processing_unavailable');
        $this->assertSame([], $this->storedFiles());
        $this->assertSame(0, ListingMedia::count());
    }

    public function test_explicit_or_uncertain_store_photo_is_not_published_or_kept(): void
    {
        foreach (['explicit' => 'avatar_explicit_content', 'uncertain' => 'avatar_uncertain_content'] as $verdict => $code) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            $this->fakePhotoService($verdict);

            $this->as($this->seller)->post('/api/v1/seller/store/avatar', ['image' => $this->image()])
                ->assertStatus(422)->assertJsonPath('error.code', $code);
            $this->assertNull($this->store->fresh()->avatarPath);
            $this->assertSame([], $this->storedFiles());
        }
    }

    public function test_store_photo_fails_closed_when_screening_is_unavailable(): void
    {
        Http::fake([
            'photo.test/sanitize*' => Http::response(self::WEBP, 200),
            'photo.test/screen' => Http::response(['error' => ['code' => 'avatar_screening_unavailable']], 503),
        ]);

        $this->as($this->seller)->post('/api/v1/seller/store/avatar', ['image' => $this->image()])
            ->assertStatus(503)->assertJsonPath('error.code', 'avatar_screening_unavailable');
        $this->assertNull($this->store->fresh()->avatarPath);
        $this->assertSame([], $this->storedFiles());
    }

    public function test_safe_store_photo_replaces_the_previous_file(): void
    {
        $this->fakePhotoService();
        $old = bin2hex(random_bytes(16)).'.webp';
        file_put_contents($this->uploads.DIRECTORY_SEPARATOR.$old, self::WEBP);
        SellerProfile::whereKey($this->store->id)->update(['avatarPath' => $old]);

        $this->as($this->seller)->post('/api/v1/seller/store/avatar', ['image' => $this->image()])->assertOk()->assertJsonStructure(['avatarUrl']);

        $current = $this->store->fresh()->avatarPath;
        $this->assertNotSame($old, $current);
        $this->assertSame([$current], $this->storedFiles());
    }

    public function test_view_counts_ignore_owner_staff_and_repeat_visitors(): void
    {
        $listing = $this->listing();

        $first = $this->postJson("/api/v1/listings/{$listing->id}/view")->assertOk()->assertJson(['count' => 1, 'recorded' => true]);
        $cookie = collect($first->headers->getCookies())->firstWhere(fn ($item) => $item->getName() === 'cpsu_listing_visitor');
        $this->assertTrue($cookie->isHttpOnly());

        $this->call('POST', "/api/v1/listings/{$listing->id}/view", [], ['cpsu_listing_visitor' => $cookie->getValue()])->assertJson(['count' => 1, 'recorded' => false]);
        $this->as($this->seller)->postJson("/api/v1/listings/{$listing->id}/view")->assertJson(['count' => 1, 'recorded' => false]);
        $this->postJson("/api/v1/listings/{$listing->id}/view", [], ['Sec-Fetch-Site' => 'cross-site'])->assertForbidden();
    }
}
