<?php

namespace Tests\Feature;

use App\Models\Campus;
use App\Models\Listing;
use App\Models\SellerProfile;
use App\Models\Transaction;
use App\Models\TransactionStatusLog;
use Database\Seeders\UniversityDashboardDemoSeeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class UniversityDashboardDemoSeederTest extends TestCase
{
    public function test_demo_seed_is_blocked_in_production(): void
    {
        $this->assertTrue(class_exists(UniversityDashboardDemoSeeder::class), 'The dashboard demo seeder must exist.');

        $this->app->detectEnvironment(fn () => 'production');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('The university dashboard demo seed is limited to local and testing environments.');

        $this->app->call([new UniversityDashboardDemoSeeder, 'run']);
    }

    public function test_demo_seed_populates_discoverable_listings_and_realistic_orders_without_duplicates(): void
    {
        if (DB::getDatabaseName() !== 'cpsu_marketplace_laravel_test' || (int) config('database.connections.mysql.port') !== 33077) {
            throw new RuntimeException('Refusing to run: tests must target the disposable database.');
        }

        DB::beginTransaction();

        try {
            $this->seed(UniversityDashboardDemoSeeder::class);

            $campuses = Campus::query()->where('code', 'like', 'DASH-DEMO-%')->get();
            $this->assertCount(10, $campuses);
            $this->assertTrue($campuses->every('active'));

            $listings = Listing::query()->whereIn('campusId', $campuses->modelKeys());
            $editedListing = (clone $listings)->firstOrFail();
            $editedListing->update(['title' => 'An edited demo listing']);
            $this->seed(UniversityDashboardDemoSeeder::class);

            $this->assertSame(25, (clone $listings)->count());
            $this->assertSame('An edited demo listing', $editedListing->fresh()->title);
            $this->assertSame(2, SellerProfile::query()->whereIn('campusId', $campuses->modelKeys())->distinct()->count('campusId'));

            $withListings = 0;
            foreach ($campuses as $campus) {
                $expected = (clone $listings)->where('campusId', $campus->id)->count();
                $this->getJson("/api/v1/listings?campusId={$campus->id}&pageSize=50")
                    ->assertOk()->assertJsonPath('total', $expected)->assertJsonCount($expected, 'items');
                $withListings += (int) ($expected > 0);
            }
            $this->assertSame(2, $withListings);

            $orders = Transaction::query()->whereIn('listingId', (clone $listings)->select('id'))->get();
            $this->assertSame($orders->count(), $orders->unique('inquiryThreadId')->count());
            $this->assertEqualsCanonicalizing(
                ['pending', 'accepted', 'negotiating', 'for_meetup', 'completed', 'cancelled'],
                $orders->pluck('status')->map->value->unique()->all(),
            );

            $completed = $orders->filter(fn (Transaction $order) => $order->status->value === 'completed'
                && $order->buyerCompletionConfirmedAt && $order->sellerCompletionConfirmedAt);
            $recent = $completed->filter(fn (Transaction $order) => $order->sellerCompletionConfirmedAt->gt(now()->subDays(7)));
            $this->assertGreaterThanOrEqual(5, $recent->groupBy(
                fn (Transaction $order) => $order->sellerCompletionConfirmedAt->tz('Asia/Manila')->toDateString(),
            )->max(fn ($day) => $day->count()));
            $this->assertSame(
                2 * $completed->count(),
                TransactionStatusLog::query()->whereIn('transactionId', $completed->modelKeys())->where('event', 'completion_confirmed')->count(),
            );
        } finally {
            DB::rollBack();
        }
    }
}
