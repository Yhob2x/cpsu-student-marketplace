<?php

namespace Tests\Feature\Api;

use App\Models\Affiliation;
use App\Models\AuditLog;
use App\Models\Campus;
use App\Models\Category;
use App\Models\InquiryMessage;
use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\ListingMedia;
use App\Models\Notification;
use App\Models\PushSubscription;
use App\Models\SellerProfile;
use App\Models\Session;
use App\Models\StoreFollow;
use App\Models\Transaction;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AccessTokens;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class MessagingTransactionsAdminApiTest extends TestCase
{
    private const REASON = 'A documented reason for this decision';

    private Campus $campus;

    private Campus $otherCampus;

    private Category $category;

    private User $seller;

    private User $buyer;

    private User $secondBuyer;

    private User $outsider;

    private User $reviewer;

    private User $otherReviewer;

    private User $admin;

    private User $system;

    private SellerProfile $store;

    protected function setUp(): void
    {
        parent::setUp();

        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new RuntimeException('Refusing to run: tests must target the disposable database.');
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['PushOutbox', 'PushSubscription', 'PushPreference', 'StoreReview', 'TransactionStatusLog', 'Transaction', 'Handoff', 'InquiryPreference', 'InquiryMessage', 'InquiryThread', 'Report', 'ListingReview', 'ListingAppreciation', 'StoreFollow', 'SavedListing', 'ListingMedia', 'ListingInventory', 'AuditLog', 'Notification', 'Listing', 'SellerProfile', 'Affiliation', 'UserRole', 'Session', 'User', 'CampusPolicy', 'Category', 'Campus'] as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->campus = Campus::create(['code' => 'MAIN', 'name' => 'Main Campus', 'active' => true]);
        $this->otherCampus = Campus::create(['code' => 'OTHER', 'name' => 'Other Campus', 'active' => true]);
        $this->category = Category::create(['name' => 'Pre-loved', 'listingType' => 'physical_product', 'policyRiskLevel' => 0]);
        $this->seller = $this->student('seller@example.test');
        $this->buyer = $this->student('buyer@example.test');
        $this->secondBuyer = $this->student('second@example.test');
        $this->outsider = $this->student('outsider@example.test');
        $this->reviewer = $this->staff('reviewer@example.test', 'campus_reviewer', $this->campus->id);
        $this->otherReviewer = $this->staff('other@example.test', 'campus_reviewer', $this->otherCampus->id);
        $this->admin = $this->staff('admin@example.test', 'university_admin', null);
        $this->system = $this->staff('system@example.test', 'system_admin', null);
        $this->store = SellerProfile::create(['ownerUserId' => $this->seller->id, 'campusId' => $this->campus->id, 'storeName' => 'Test Store', 'description' => 'A store for tests', 'sellerType' => 'student', 'approvalStatus' => 'approved']);
    }

    private function student(string $email): User
    {
        $user = User::create(['email' => $email, 'displayName' => 'Student', 'passwordHash' => 'not-a-login']);
        Affiliation::create(['userId' => $user->id, 'campusId' => $this->campus->id, 'verificationStatus' => 'verified', 'verifiedAt' => now()]);

        return $user;
    }

    private function staff(string $email, string $role, ?int $campusId): User
    {
        $user = User::create(['email' => $email, 'displayName' => 'Staff', 'passwordHash' => 'not-a-login']);
        UserRole::create(['userId' => $user->id, 'role' => $role, 'campusId' => $campusId]);

        return $user;
    }

    private function listing(int $stock = 1, string $status = 'published'): Listing
    {
        $listing = Listing::create([
            'sellerProfileId' => $this->store->id, 'campusId' => $this->campus->id, 'categoryId' => $this->category->id, 'type' => 'physical_product',
            'title' => 'Test item', 'description' => 'A useful item for students', 'price' => '100.00', 'condition' => 'good', 'status' => $status,
        ]);
        ListingInventory::create(['listingId' => $listing->id, 'availableQuantity' => $stock]);

        return $listing->fresh();
    }

    private function as(User $user): static
    {
        return $this->withToken(app(AccessTokens::class)->sign($user->id));
    }

    private function order(Listing $listing, ?User $buyer = null): int
    {
        return $this->as($buyer ?? $this->buyer)->postJson('/api/v1/transactions', ['listingId' => $listing->id])->assertCreated()->json('id');
    }

    public function test_conversations_are_private_to_their_participants(): void
    {
        $thread = $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $this->listing()->id, 'body' => 'Is this available?'])->assertCreated()->json('id');

        $this->withoutToken()->getJson("/api/v1/inquiries/{$thread}/messages")->assertUnauthorized();
        $this->as($this->outsider)->getJson("/api/v1/inquiries/{$thread}/messages")->assertNotFound();
        $this->as($this->reviewer)->getJson("/api/v1/inquiries/{$thread}/messages")->assertForbidden();
        $this->as($this->outsider)->postJson("/api/v1/inquiries/{$thread}/messages", ['body' => 'Intrusion'])->assertNotFound();
        $this->as($this->seller)->getJson("/api/v1/inquiries/{$thread}/messages")->assertOk()->assertJsonPath('messages.0.body', 'Is this available?');
        $this->assertSame(1, InquiryMessage::count());
    }

    public function test_repeat_inquiry_reuses_the_thread_without_consuming_an_id(): void
    {
        $listing = $this->listing();
        $first = $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $listing->id, 'body' => 'First'])->json('id');
        $repeat = $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $listing->id, 'body' => 'Second'])->json('id');
        $next = $this->as($this->secondBuyer)->postJson('/api/v1/inquiries', ['listingId' => $listing->id, 'body' => 'Third'])->json('id');

        $this->assertSame($first, $repeat);
        $this->assertSame($first + 1, $next);
    }

    public function test_closed_conversation_rejects_new_messages(): void
    {
        $listing = $this->listing();
        $thread = $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $listing->id, 'body' => 'Hello'])->json('id');
        $this->as($this->seller)->postJson("/api/v1/inquiries/{$thread}/close")->assertNoContent();

        $this->as($this->buyer)->postJson("/api/v1/inquiries/{$thread}/messages", ['body' => 'Late'])->assertStatus(409)->assertJsonPath('error.code', 'thread_closed');
        $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $listing->id, 'body' => 'Reopen'])->assertStatus(409)->assertJsonPath('error.code', 'thread_closed');
        $this->assertSame(1, InquiryMessage::count());
    }

    public function test_seen_receipts_never_mark_later_messages_as_read(): void
    {
        $thread = $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $this->listing()->id, 'body' => 'Buyer message'])->json('id');
        $first = $this->as($this->seller)->postJson("/api/v1/inquiries/{$thread}/messages", ['body' => 'First reply'])->json('id');
        $second = $this->as($this->seller)->postJson("/api/v1/inquiries/{$thread}/messages", ['body' => 'Second reply'])->json('id');

        $this->as($this->buyer)->postJson("/api/v1/inquiries/{$thread}/seen", ['upToId' => $first])->assertNoContent();

        $this->assertNotNull(InquiryMessage::findOrFail($first)->seenAt);
        $this->assertNull(InquiryMessage::findOrFail($second)->seenAt);
    }

    public function test_full_transaction_requires_both_students_and_updates_stock(): void
    {
        $listing = $this->listing(2);
        $id = $this->order($listing);

        $this->as($this->buyer)->postJson("/api/v1/transactions/{$id}/decision", ['action' => 'accept'])->assertNotFound();
        $this->as($this->outsider)->getJson("/api/v1/transactions/{$id}")->assertNotFound();
        $this->as($this->seller)->postJson("/api/v1/transactions/{$id}/decision", ['action' => 'accept'])->assertOk()->assertJsonPath('status', 'accepted');
        $this->assertSame([1, 1], [ListingInventory::find($listing->id)->availableQuantity, ListingInventory::find($listing->id)->reservedQuantity]);

        $this->as($this->buyer)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk()->assertJsonPath('status', 'accepted');
        $this->as($this->buyer)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertStatus(409);
        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk()->assertJsonPath('status', 'for_meetup');
        $this->as($this->buyer)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk()->assertJsonPath('status', 'for_meetup');
        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('activeThreadId', null);

        $this->assertSame([1, 0], [ListingInventory::find($listing->id)->availableQuantity, ListingInventory::find($listing->id)->reservedQuantity]);
        $this->assertSame('available', $listing->fresh()->availabilityState->value);
    }

    public function test_last_unit_cannot_be_accepted_for_two_buyers_and_cancel_restores_it(): void
    {
        $listing = $this->listing(1);
        $first = $this->order($listing);
        $second = $this->order($listing, $this->secondBuyer);

        $this->as($this->seller)->postJson("/api/v1/transactions/{$first}/decision", ['action' => 'accept'])->assertOk();
        $this->assertSame('reserved', $listing->fresh()->availabilityState->value);
        $this->as($this->seller)->postJson("/api/v1/transactions/{$second}/decision", ['action' => 'accept'])->assertStatus(409);
        $this->assertSame('pending', Transaction::findOrFail($second)->status->value);

        $this->as($this->buyer)->postJson("/api/v1/transactions/{$first}/cancel", ['reason' => self::REASON])->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertSame([1, 0], [ListingInventory::find($listing->id)->availableQuantity, ListingInventory::find($listing->id)->reservedQuantity]);
        $this->assertSame('available', $listing->fresh()->availabilityState->value);
    }

    public function test_staff_and_unverified_accounts_cannot_transact(): void
    {
        $listing = $this->listing();
        $unverified = User::create(['email' => 'unverified@example.test', 'displayName' => 'Unverified', 'passwordHash' => 'x']);
        Affiliation::create(['userId' => $unverified->id, 'campusId' => $this->campus->id, 'verificationStatus' => 'pending']);

        $this->as($this->admin)->postJson('/api/v1/transactions', ['listingId' => $listing->id])->assertForbidden()->assertJsonPath('error.code', 'student_account_required');
        $this->as($unverified)->postJson('/api/v1/transactions', ['listingId' => $listing->id])->assertForbidden()->assertJsonPath('error.code', 'student_verification_required');
        $this->as($this->seller)->postJson('/api/v1/transactions', ['listingId' => $listing->id])->assertStatus(400)->assertJsonPath('error.code', 'own_listing');
        $this->assertSame(0, Transaction::count());
    }

    public function test_listing_approval_is_campus_scoped_and_requires_photo_review(): void
    {
        $listing = $this->listing(1, 'pending_review');
        ListingMedia::create(['listingId' => $listing->id, 'mediaPath' => str_repeat('a', 32).'.webp', 'mimeType' => 'image/webp', 'position' => 0]);
        $approve = ['decision' => 'approved', 'reason' => self::REASON, 'photosReviewed' => true];

        $this->as($this->buyer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertForbidden();
        $this->as($this->system)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertForbidden();
        $this->as($this->otherReviewer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertNotFound();
        $this->as($this->reviewer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", ['decision' => 'approved', 'reason' => self::REASON])
            ->assertStatus(422)->assertJsonPath('error.code', 'photo_review_required');
        $this->assertSame('pending_review', $listing->fresh()->status->value);

        $this->as($this->reviewer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertOk()->assertJsonPath('status', 'published');
        $this->assertTrue(AuditLog::where('action', 'listing.approved')->where('targetId', $listing->id)->exists());
    }

    public function test_followers_are_notified_only_on_first_approval(): void
    {
        $listing = $this->listing(1, 'pending_review');
        ListingMedia::create(['listingId' => $listing->id, 'mediaPath' => str_repeat('b', 32).'.webp', 'mimeType' => 'image/webp', 'position' => 0]);
        StoreFollow::query()->insert(['userId' => $this->buyer->id, 'sellerProfileId' => $this->store->id, 'createdAt' => now()->format('Y-m-d H:i:s.v')]);
        $approve = ['decision' => 'approved', 'reason' => self::REASON, 'photosReviewed' => true];

        $this->as($this->reviewer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertOk();
        Listing::whereKey($listing->id)->update(['status' => 'pending_review']);
        $this->as($this->reviewer)->postJson("/api/v1/admin/listings/{$listing->id}/decision", $approve)->assertOk();

        $this->assertSame(1, Notification::where('userId', $this->buyer->id)->where('type', 'store.new_listing')->count());
    }

    public function test_university_admin_routes_reject_other_roles(): void
    {
        foreach ([$this->buyer, $this->reviewer, $this->system] as $user) {
            foreach (['audit-logs', 'users', 'reviewers', 'catalog', 'content/guidelines', 'content/home-page'] as $path) {
                $this->as($user)->getJson("/api/v1/admin/{$path}")->assertForbidden();
            }
        }
        $this->withoutToken()->getJson('/api/v1/admin/users')->assertUnauthorized();
        $this->as($this->admin)->getJson('/api/v1/admin/users')->assertOk();
    }

    public function test_suspension_revokes_sessions_and_protects_staff_and_self(): void
    {
        Session::create(['userId' => $this->buyer->id, 'refreshTokenHash' => str_repeat('c', 64), 'device' => 'test', 'expiresAt' => Carbon::now()->addDay()]);
        $suspend = ['status' => 'suspended', 'reason' => self::REASON];

        $this->as($this->admin)->patchJson("/api/v1/admin/users/{$this->admin->id}/status", $suspend)->assertStatus(409)->assertJsonPath('error.code', 'self_status_change_forbidden');
        $this->as($this->admin)->patchJson("/api/v1/admin/users/{$this->reviewer->id}/status", $suspend)->assertForbidden()->assertJsonPath('error.code', 'staff_account_protected');
        $this->as($this->admin)->patchJson("/api/v1/admin/users/{$this->buyer->id}/status", $suspend)->assertOk();

        $this->assertSame(0, Session::where('userId', $this->buyer->id)->whereNull('revokedAt')->count());
        $this->as($this->buyer)->getJson('/api/v1/me')->assertUnauthorized();
        $this->assertTrue(AuditLog::where('action', 'user.suspended')->where('targetId', $this->buyer->id)->exists());
    }

    public function test_analytics_suppresses_small_counts(): void
    {
        $this->listing();

        $this->as($this->reviewer)->getJson('/api/v1/admin/analytics/overview')->assertOk()
            ->assertJsonPath('campuses.0.publishedListings', '<5')->assertJsonCount(1, 'campuses');
    }

    public function test_push_stays_off_by_default_and_never_queues_delivery(): void
    {
        $this->as($this->buyer)->getJson('/api/v1/push/config')->assertOk()->assertExactJson(['enabled' => false, 'deliveryEnabled' => false, 'publicKey' => null]);
        $this->as($this->buyer)->postJson('/api/v1/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/device', 'keys' => ['p256dh' => str_repeat('B', 87), 'auth' => str_repeat('c', 22)]])
            ->assertStatus(503)->assertJsonPath('error.code', 'push_not_configured');
        $this->as($this->buyer)->postJson('/api/v1/inquiries', ['listingId' => $this->listing()->id, 'body' => 'Hello'])->assertCreated();

        $this->assertSame(0, PushSubscription::count());
        $this->assertSame(0, DB::table('PushOutbox')->count());
        $this->assertSame(1, Notification::where('userId', $this->seller->id)->count());
    }
}
