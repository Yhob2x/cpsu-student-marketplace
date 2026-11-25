<?php

namespace Tests\Feature\Api;

use App\Models\Affiliation;
use App\Models\Campus;
use App\Models\Category;
use App\Models\InquiryThread;
use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\ListingReview;
use App\Models\SellerProfile;
use App\Models\Transaction;
use App\Models\TransactionStatusLog;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AccessTokens;
use App\Support\AnalyticsRange;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class AnalyticsApiTest extends TestCase
{
    private Campus $campus;

    private Campus $otherCampus;

    private Category $category;

    private User $seller;

    private User $buyer;

    private User $reviewer;

    private User $otherReviewer;

    private User $admin;

    private SellerProfile $store;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new RuntimeException('Refusing to run: tests must target the disposable database.');
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (['ListingViewDaily', 'ListingViewCounter', 'ListingViewDedup', 'StoreReview', 'TransactionStatusLog', 'Transaction', 'Handoff', 'InquiryPreference', 'InquiryMessage', 'InquiryThread', 'Report', 'ListingReview', 'ListingAppreciation', 'StoreFollow', 'SavedListing', 'ListingMedia', 'ListingInventory', 'AuditLog', 'Notification', 'Listing', 'SellerProfile', 'Affiliation', 'UserRole', 'Session', 'User', 'CampusPolicy', 'Category', 'Campus'] as $table) {
            DB::table($table)->truncate();
        }
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $this->campus = Campus::create(['code' => 'MAIN', 'name' => 'Main Campus', 'active' => true]);
        $this->otherCampus = Campus::create(['code' => 'OTHER', 'name' => 'Other Campus', 'active' => true]);
        $this->category = Category::create(['name' => 'Pre-loved', 'listingType' => 'physical_product', 'policyRiskLevel' => 0]);
        $this->seller = $this->student('seller@example.test');
        $this->buyer = $this->student('buyer@example.test');
        $this->reviewer = $this->staff('reviewer@example.test', 'campus_reviewer', $this->campus->id);
        $this->otherReviewer = $this->staff('other@example.test', 'campus_reviewer', $this->otherCampus->id);
        $this->admin = $this->staff('admin@example.test', 'university_admin', null);
        $this->store = SellerProfile::create(['ownerUserId' => $this->seller->id, 'campusId' => $this->campus->id, 'storeName' => 'Test Store', 'description' => 'A store for tests', 'sellerType' => 'student', 'approvalStatus' => 'approved']);
    }

    private function student(string $email, string $name = 'Student'): User
    {
        $user = User::create(['email' => $email, 'displayName' => $name, 'passwordHash' => 'not-a-login']);
        Affiliation::create(['userId' => $user->id, 'campusId' => $this->campus->id, 'verificationStatus' => 'verified', 'verifiedAt' => now()]);

        return $user;
    }

    private function staff(string $email, string $role, ?int $campusId): User
    {
        $user = User::create(['email' => $email, 'displayName' => 'Staff', 'passwordHash' => 'not-a-login']);
        UserRole::create(['userId' => $user->id, 'role' => $role, 'campusId' => $campusId]);

        return $user;
    }

    private function listing(int $stock = 3, string $price = '250.00'): Listing
    {
        $listing = Listing::create([
            'sellerProfileId' => $this->store->id, 'campusId' => $this->campus->id, 'categoryId' => $this->category->id, 'type' => 'physical_product',
            'title' => 'Scientific calculator', 'description' => 'A useful item for students', 'price' => $price, 'condition' => 'good', 'status' => 'published',
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

    private function complete(int $id, ?User $buyer = null): void
    {
        $buyer ??= $this->buyer;
        $this->as($this->seller)->postJson("/api/v1/transactions/{$id}/decision", ['action' => 'accept'])->assertOk();
        $this->as($buyer)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk();
        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk();
        $this->as($buyer)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk();
        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk()->assertJsonPath('status', 'completed');
    }

    /** Moves an order and its status history back in time. */
    private function age(int $transactionId, int $days): void
    {
        DB::table('Transaction')->where('id', $transactionId)->update(['createdAt' => DB::raw("DATE_SUB(createdAt, INTERVAL {$days} DAY)")]);
        DB::table('TransactionStatusLog')->where('transactionId', $transactionId)->update(['createdAt' => DB::raw("DATE_SUB(createdAt, INTERVAL {$days} DAY)")]);
    }

    public function test_seller_sees_reported_sales_pipeline_and_orders_to_handle(): void
    {
        $listing = $this->listing();
        $this->complete($this->order($listing));
        $waiting = $this->order($listing, $this->student('second@example.test', 'Second Buyer'));

        $response = $this->as($this->seller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('range.key', '30d')
            ->assertJsonPath('summary.current.reportedSales', 250)
            ->assertJsonPath('summary.current.completedOrders', 1)
            ->assertJsonPath('summary.current.ordersCreated', 2)
            ->assertJsonPath('summary.current.averageOrderValue', 250)
            ->assertJsonPath('summary.current.cancellationRate', 0)
            ->assertJsonPath('summary.previous.completedOrders', 0)
            ->assertJsonPath('pipeline.pending', 1)
            ->assertJsonPath('needsAction.0.id', $waiting)
            ->assertJsonPath('needsAction.0.action', 'decide')
            ->assertJsonPath('needsAction.0.buyerName', 'Second Buyer')
            ->assertJsonPath('listings.0.id', $listing->id)
            ->assertJsonPath('listings.0.completedOrders', 1)
            ->assertJsonPath('listings.0.reportedSales', 250)
            ->assertJsonPath('listings.0.stock', 2);

        $this->assertCount(30, $response->json('trend'));
        $this->assertSame(250, array_sum(array_column($response->json('trend'), 'reportedSales')));
        $this->assertSame(1, array_sum(array_column($response->json('trend'), 'ordersCompleted')));
    }

    public function test_orders_waiting_on_seller_confirmation_and_buyer_are_separated(): void
    {
        $id = $this->order($this->listing());
        $this->as($this->seller)->postJson("/api/v1/transactions/{$id}/decision", ['action' => 'accept'])->assertOk();

        $this->as($this->seller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertJsonPath('needsAction.0.action', 'confirm_meetup')->assertJsonPath('waitingOnBuyer', 0);

        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk();
        $this->as($this->seller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertJsonCount(0, 'needsAction')->assertJsonPath('waitingOnBuyer', 1)->assertJsonPath('pipeline.accepted', 1);
    }

    public function test_previous_period_and_cancellations_are_counted_by_when_they_happened(): void
    {
        $listing = $this->listing(5);
        $old = $this->order($listing);
        $this->complete($old);
        $this->age($old, 40);
        $cancelled = $this->order($listing);
        $this->as($this->buyer)->postJson("/api/v1/transactions/{$cancelled}/cancel", ['reason' => 'Changed my mind about the item'])->assertOk();

        $this->as($this->seller)->getJson('/api/v1/seller/analytics?range=30d')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', 0)
            ->assertJsonPath('summary.current.cancelledOrders', 1)
            ->assertJsonPath('summary.current.cancellationRate', 1)
            ->assertJsonPath('summary.previous.completedOrders', 1)
            ->assertJsonPath('summary.previous.reportedSales', 250);

        $this->as($this->seller)->getJson('/api/v1/seller/analytics?range=90d')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', 1)->assertJsonCount(13, 'trend');
    }

    public function test_store_rating_and_low_stock_are_reported(): void
    {
        $listing = $this->listing(2);
        $id = $this->order($listing);
        $this->complete($id);
        DB::table('StoreReview')->insert(['transactionId' => $id, 'sellerProfileId' => $this->store->id, 'buyerUserId' => $this->buyer->id, 'rating' => 4, 'status' => 'published', 'createdAt' => now()]);

        $this->as($this->seller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertJsonPath('rating.average', 4)->assertJsonPath('rating.count', 1)->assertJsonPath('rating.distribution.4', 1)
            ->assertJsonPath('lowStock.0.id', $listing->id)->assertJsonPath('lowStock.0.stock', 1);
    }

    public function test_seller_analytics_validates_input_and_access(): void
    {
        $this->getJson('/api/v1/seller/analytics')->assertUnauthorized();
        $this->as($this->reviewer)->getJson('/api/v1/seller/analytics')->assertForbidden();
        $this->as($this->buyer)->getJson('/api/v1/seller/analytics')->assertNotFound()->assertJsonPath('error.code', 'no_store');
        $this->as($this->seller)->getJson('/api/v1/seller/analytics?range=5y')->assertStatus(400)
            ->assertJsonPath('error.code', 'validation_error')->assertJsonPath('error.issues.0.path.0', 'range');
        $this->as($this->seller)->getJson('/api/v1/seller/analytics?range=7d&storeId=99')->assertStatus(400);
        $this->as($this->seller)->getJson('/api/v1/seller/analytics?range=12m')->assertOk()->assertJsonCount(12, 'trend')->assertJsonPath('range.bucket', 'month');
    }

    public function test_seller_only_sees_their_own_store(): void
    {
        $otherSeller = $this->student('other-seller@example.test');
        SellerProfile::create(['ownerUserId' => $otherSeller->id, 'campusId' => $this->campus->id, 'storeName' => 'Other Store', 'description' => 'Another store for tests', 'sellerType' => 'student', 'approvalStatus' => 'approved']);
        $this->complete($this->order($this->listing()));

        $this->as($otherSeller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', 0)->assertJsonCount(0, 'listings')->assertJsonCount(0, 'needsAction');
    }

    public function test_listing_views_are_counted_per_day_once_per_visitor(): void
    {
        $listing = $this->listing();
        $first = $this->postJson("/api/v1/listings/{$listing->id}/view")->assertOk()->assertJsonPath('recorded', true);
        $cookie = $first->getCookie('cpsu_listing_visitor', false)?->getValue();
        $this->withCredentials()->withUnencryptedCookie('cpsu_listing_visitor', (string) $cookie)->postJson("/api/v1/listings/{$listing->id}/view")->assertOk()->assertJsonPath('recorded', false);
        $this->as($this->seller)->postJson("/api/v1/listings/{$listing->id}/view")->assertOk()->assertJsonPath('recorded', false);

        $this->assertSame(1, (int) DB::table('ListingViewDaily')->where('listingId', $listing->id)->value('viewCount'));
        $this->as($this->seller)->getJson('/api/v1/seller/analytics')->assertOk()
            ->assertJsonPath('summary.current.views', 1)->assertJsonPath('listings.0.views', 1)->assertJsonPath('listings.0.totalViews', 1);
    }

    public function test_admin_analytics_hide_small_groups_and_respect_campus_scope(): void
    {
        $this->complete($this->order($this->listing()));

        $this->as($this->reviewer)->getJson('/api/v1/admin/analytics/dashboard')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', '<5')
            ->assertJsonPath('summary.current.reportedSales', null)
            ->assertJsonPath('summary.current.averageOrderValue', null)
            ->assertJsonPath('campuses.0.campus', 'MAIN')
            ->assertJsonPath('campuses.0.completedOrders', '<5')
            ->assertJsonCount(1, 'campuses');
        $this->as($this->otherReviewer)->getJson('/api/v1/admin/analytics/dashboard')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', 0)->assertJsonPath('campuses.0.campus', 'OTHER');
        $this->as($this->admin)->getJson('/api/v1/admin/analytics/dashboard?range=7d')->assertOk()
            ->assertJsonCount(2, 'campuses')->assertJsonCount(7, 'trend');
        $this->as($this->seller)->getJson('/api/v1/admin/analytics/dashboard')->assertForbidden();
        $this->as($this->admin)->getJson('/api/v1/admin/analytics/dashboard?range=forever')->assertStatus(400);
    }

    public function test_admin_sales_appear_from_five_completed_orders(): void
    {
        $listing = $this->listing(10);
        foreach (range(1, 5) as $n) {
            $this->complete($this->order($listing, $this->student("buyer{$n}@example.test")), User::where('email', "buyer{$n}@example.test")->first());
        }
        $pending = $this->listing();
        Listing::whereKey($pending->id)->update(['status' => 'pending_review']);

        $this->as($this->admin)->getJson('/api/v1/admin/analytics/dashboard')->assertOk()
            ->assertJsonPath('summary.current.completedOrders', 5)
            ->assertJsonPath('summary.current.reportedSales', 1250)
            ->assertJsonPath('summary.current.averageOrderValue', 250)
            ->assertJsonPath('categories.0.name', 'Pre-loved')
            ->assertJsonPath('categories.0.reportedSales', 1250)
            ->assertJsonPath('workload.pendingListings', 1);
    }

    public function test_university_dashboard_requires_a_university_admin_and_a_valid_period(): void
    {
        $path = '/api/admin/dashboard';
        $this->getJson($path)->assertUnauthorized();
        $this->as($this->buyer)->getJson($path)->assertForbidden();
        $this->as($this->reviewer)->getJson($path)->assertForbidden();
        $this->as($this->reviewer)->getJson('/api/v1/admin/analytics/dashboard')->assertOk();
        $this->as($this->admin)->getJson($path.'?period=forever')->assertBadRequest()
            ->assertJsonPath('error.issues.0.path.0', 'period');
        $this->as($this->admin)->getJson($path.'?period=7d&campusId=1')->assertBadRequest();

        foreach ([
            '' => ['30d', 'previous 30 days', 'day', 30],
            '?period=7d' => ['7d', 'previous 7 days', 'day', 7],
            '?period=90d' => ['90d', 'previous 90 days', 'week', 13],
            '?period=12m' => ['12m', 'previous 12 months', 'month', 12],
        ] as $query => [$period, $previousLabel, $bucket, $points]) {
            $this->as($this->admin)->getJson($path.$query)->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('period', $period)
                ->assertJsonPath('previousPeriodLabel', $previousLabel)
                ->assertJsonPath('series.granularity', $bucket)
                ->assertJsonCount($points, 'series.points');
        }
    }

    public function test_university_dashboard_masks_small_counts_and_excludes_unavailable_listings(): void
    {
        $this->travelTo(now()->setTimezone('Asia/Manila')->setTime(12, 0)->addDay()->utc());
        $published = $this->listing();
        $pending = $this->listing();
        $pending->update(['status' => 'pending_review']);
        $this->listing()->update(['availabilityState' => 'sold']);
        $this->listing()->update(['deletedAt' => now()]);
        $this->listing()->update(['status' => 'draft']);
        $this->listing()->update(['sellerProfileId' => SellerProfile::create([
            'ownerUserId' => $this->buyer->id, 'campusId' => $this->campus->id, 'storeName' => 'Pending Store',
            'description' => 'A store for tests', 'sellerType' => 'student', 'approvalStatus' => 'pending',
        ])->id]);
        Affiliation::create(['userId' => $this->buyer->id, 'campusId' => $this->otherCampus->id, 'verificationStatus' => 'pending']);
        Affiliation::create(['userId' => $this->seller->id, 'campusId' => $this->otherCampus->id, 'verificationStatus' => 'verified', 'verifiedAt' => now()->subSecond()]);
        foreach (range(1, 2) as $number) {
            $student = $this->student("new{$number}@example.test");
            $student->affiliations()->update(['verifiedAt' => now()->subSecond()]);
        }
        for ($review = 0; $review < 5; $review++) {
            ListingReview::create([
                'listingId' => $published->id, 'reviewerId' => $this->admin->id, 'decision' => 'approved',
                'reason' => 'Approved', 'createdAt' => now()->subSecond(),
            ]);
        }
        $this->recordDashboardOrder($published, 'completed', now()->subHour(), now()->subSecond());
        $this->recordDashboardOrder($published, 'accepted', now()->subMinutes(2));
        $this->recordDashboardOrder($published, 'negotiating', now()->subMinutes(2));
        $this->recordDashboardOrder($published, 'for_meetup', now()->subMinutes(2));

        $response = $this->as($this->admin)->getJson('/api/admin/dashboard?period=7d')->assertOk();
        $response->assertJsonPath('reviewQueue', ['listings' => '<5', 'verifications' => '<5'])
            ->assertJsonPath('kpis.liveListings', '<5')->assertJsonPath('kpis.newOrders', '<5')
            ->assertJsonPath('kpis.completedOrders', '<5')->assertJsonPath('kpis.inquiries', '<5')
            ->assertJsonPath('kpis.listingsApproved', '<5')->assertJsonPath('kpis.studentsVerified', '<5')
            ->assertJsonPath('kpis.changes', array_fill_keys(['newOrders', 'completedOrders', 'inquiries', 'listingsApproved', 'studentsVerified'], null))
            ->assertJsonPath('funnel', array_fill_keys(['liveListings', 'inquiries', 'orders', 'completed'], '<5'))
            ->assertJsonPath('ordersInProgress', ['awaitingSeller' => 0, 'accepted' => '<5', 'arrangingMeetup' => '<5', 'meetupAgreed' => '<5'])
            ->assertJsonPath('quality', null)->assertJsonPath('series.points.0.completed', 0)
            ->assertJsonPath('series.points.6.completed', '<5')
            ->assertJsonPath('categories', [['name' => 'Pre-loved', 'liveListings' => '<5']])
            ->assertJsonPath('campuses', [[
                'name' => 'Main Campus', 'storefronts' => '<5', 'liveListings' => '<5', 'newOrders' => '<5',
                'completed' => '<5', 'reportedSales' => null,
            ]])
            ->assertJsonPath('inactiveCampusCount', '<5');
        $this->assertSame(
            ['period', 'previousPeriodLabel', 'generatedAt', 'reviewQueue', 'kpis', 'funnel', 'ordersInProgress', 'series', 'quality', 'categories', 'campuses', 'inactiveCampusCount'],
            array_keys($response->json()),
        );
    }

    public function test_university_dashboard_counts_completed_orders_once_and_totals_only_confirmed_sales(): void
    {
        $this->travelTo(now()->setTimezone('Asia/Manila')->setTime(12, 0)->addDay()->utc());
        $listing = $this->listing(10, '999.99');
        for ($number = 0; $number < 5; $number++) {
            $order = $this->recordDashboardOrder($listing, 'completed', now()->subDays(2), now()->subDay());
            TransactionStatusLog::create([
                'transactionId' => $order->id, 'actorUserId' => $this->buyer->id, 'toStatus' => 'completed',
                'event' => 'completed', 'createdAt' => now()->subHour(),
            ]);
            $past = $this->recordDashboardOrder($listing, 'completed', now()->subDays(9), now()->subDays(8));
            TransactionStatusLog::create([
                'transactionId' => $past->id, 'actorUserId' => $this->buyer->id, 'toStatus' => 'completed',
                'event' => 'completed', 'createdAt' => now()->subHour(),
            ]);
        }
        $unconfirmed = $this->recordDashboardOrder($listing, 'completed', now()->subDays(2), now()->subDay());
        $unconfirmed->update(['buyerCompletionConfirmedAt' => null]);
        $this->recordDashboardOrder($listing, 'cancelled', now()->subDays(2), now()->subDay());

        $this->as($this->admin)->getJson('/api/admin/dashboard?period=7d')->assertOk()
            ->assertJsonPath('kpis.newOrders', 7)
            ->assertJsonPath('kpis.completedOrders', 5)
            ->assertJsonPath('kpis.changes.newOrders', 40)
            ->assertJsonPath('kpis.changes.completedOrders', 0)
            ->assertJsonPath('quality.reportedSales', 1250)
            ->assertJsonPath('quality.cancellationRatePct', null)
            ->assertJsonPath('quality.avgDaysToComplete', 1)
            ->assertJsonPath('series.points.5.completed', 5)
            ->assertJsonPath('series.points.6.completed', 0)
            ->assertJsonPath('campuses.0.completed', 5)
            ->assertJsonPath('campuses.0.reportedSales', 1250);

        for ($number = 0; $number < 4; $number++) {
            $this->recordDashboardOrder($listing, 'cancelled', now()->subDays(2), now()->subDay());
        }
        $this->travel(60)->seconds();
        $this->as($this->admin)->getJson('/api/admin/dashboard?period=7d')->assertOk()
            ->assertJsonPath('quality.cancellationRatePct', 50);
    }

    public function test_university_dashboard_caches_each_period_for_sixty_seconds(): void
    {
        $this->travelTo(now()->setTimezone('Asia/Manila')->setTime(12, 0)->addDay()->utc());
        $first = $this->as($this->admin)->getJson('/api/admin/dashboard?period=30d')->assertOk()->json();
        $this->listing();

        $this->travel(59)->seconds();
        $this->as($this->admin)->getJson('/api/admin/dashboard')->assertOk()->assertExactJson($first);
        $this->as($this->admin)->getJson('/api/admin/dashboard?period=7d')->assertOk()->assertJsonPath('kpis.liveListings', '<5');

        $this->travel(1)->seconds();
        $this->as($this->admin)->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('kpis.liveListings', '<5');
    }

    public function test_university_dashboard_observes_completion_through_the_order_workflow(): void
    {
        $id = $this->order($this->listing());
        $this->as($this->seller)->postJson("/api/v1/transactions/{$id}/decision", ['action' => 'accept'])->assertOk();
        $this->as($this->buyer)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk();
        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-meetup")->assertOk();
        $this->as($this->buyer)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk();

        $this->as($this->admin)->getJson('/api/admin/dashboard?period=30d')->assertOk()
            ->assertJsonPath('kpis.completedOrders', 0)->assertJsonPath('ordersInProgress.meetupAgreed', '<5');

        $this->as($this->seller)->post("/api/v1/transactions/{$id}/confirm-completion")->assertOk()->assertJsonPath('status', 'completed');
        $this->travel(1)->seconds();
        $this->as($this->admin)->getJson('/api/admin/dashboard?period=7d')->assertOk()
            ->assertJsonPath('kpis.completedOrders', '<5')->assertJsonPath('ordersInProgress.meetupAgreed', 0)
            ->assertJsonPath('quality', null);
    }

    private function recordDashboardOrder(Listing $listing, string $status, DateTimeInterface $createdAt, ?DateTimeInterface $transitionAt = null): Transaction
    {
        $thread = InquiryThread::firstOrCreate(
            ['listingId' => $listing->id, 'buyerUserId' => $this->buyer->id],
            ['sellerProfileId' => $this->store->id, 'createdAt' => $createdAt],
        );
        $order = Transaction::create([
            'inquiryThreadId' => $thread->id, 'listingId' => $listing->id, 'buyerUserId' => $this->buyer->id,
            'sellerUserId' => $this->seller->id, 'status' => $status, 'price' => '250.00', 'createdAt' => $createdAt,
            'buyerCompletionConfirmedAt' => $status === 'completed' ? $transitionAt : null,
            'sellerCompletionConfirmedAt' => $status === 'completed' ? $transitionAt : null,
        ]);
        if ($transitionAt !== null) {
            TransactionStatusLog::create([
                'transactionId' => $order->id, 'actorUserId' => $this->buyer->id, 'toStatus' => $status,
                'event' => $status, 'createdAt' => $transitionAt,
            ]);
        }

        return $order;
    }

    public function test_ranges_use_campus_local_days_and_do_not_overlap(): void
    {
        $now = CarbonImmutable::parse('2026-11-24 01:30:00', 'UTC');
        $range = AnalyticsRange::make('7d', $now);
        $this->assertSame('2026-11-18', $range->start->format('Y-m-d'));
        $this->assertSame(['2026-11-17 16:00:00.000', '2026-11-24 01:30:00.000'], $range->utcBounds());
        $this->assertSame($range->start->toIso8601String(), $range->previous()->end->toIso8601String());
        $this->assertSame(['2026-11-11', '2026-11-17'], $range->previous()->localDays());
        $this->assertCount(13, AnalyticsRange::make('90d', $now)->buckets());
        $this->assertSame('2026-11', array_key_last(AnalyticsRange::make('12m', $now)->buckets()));
        $this->assertSame('2026-11-23', AnalyticsRange::make('90d', $now)->bucketKey('2026-11-24'));
    }
}
