<?php

namespace Database\Seeders;

use App\Models\Affiliation;
use App\Models\Campus;
use App\Models\Category;
use App\Models\Handoff;
use App\Models\InquiryThread;
use App\Models\Listing;
use App\Models\ListingInventory;
use App\Models\ListingReview;
use App\Models\SellerProfile;
use App\Models\Transaction;
use App\Models\TransactionStatusLog;
use App\Models\User;
use App\Models\UserRole;
use App\Services\ListingStock;
use App\Services\PasswordHasher;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class UniversityDashboardDemoSeeder extends Seeder
{
    private const EMAIL_DOMAIN = 'dashboard-demo.example';

    private const ADMIN_PASSWORD = 'DashboardDemo!2026';

    private const CAMPUSES = [
        'RIVERSIDE' => 'Riverside', 'CEDAR' => 'Cedar', 'BROOKSIDE' => 'Brookside',
        'HILLCREST' => 'Hillcrest', 'LAKESIDE' => 'Lakeside', 'MEADOW' => 'Meadow',
        'ORCHARD' => 'Orchard', 'PINE' => 'Pine', 'RIDGE' => 'Ridge', 'VALLEY' => 'Valley',
    ];

    private const CATEGORIES = [
        'books' => ['Books & notes (pre-loved)', 'physical_product', 'per item'],
        'preloved' => ['Pre-loved items', 'physical_product', 'per item'],
        'handmade' => ['Handmade goods', 'physical_product', 'per item'],
        'design' => ['Design & creative', 'service', 'per project'],
        'tech' => ['Tech & IT help', 'service', 'per session'],
    ];

    private const STORES = [
        'paper-trail' => ['RIVERSIDE', 'Paper Trail', 'Pre-loved books and study materials.', [
            ['books', 'Introductory statistics textbook', 280, 'Used for one semester, with a few notes in pencil.', ['completed', 2]],
            ['books', 'Calculus practice workbook', 145, 'Most exercise pages are blank. Includes the answer booklet.', ['completed', 2]],
            ['books', 'Technical writing handbook', 190, 'A compact reference for lab reports and project proposals.', ['completed', 4]],
            ['books', 'Basic accounting reviewer', 110, 'Practice sheets and sample journal entries in a labeled folder.', ['pending', 0]],
            ['books', 'Field botany notebook set', 125, 'Two unused grid notebooks from a fieldwork kit.', ['completed', 34]],
        ]],
        'campus-reuse' => ['RIVERSIDE', 'Campus Reuse', 'School and dorm supplies for another term.', [
            ['preloved', 'Scientific calculator', 450, 'Working calculator with a slide cover and fresh batteries.', ['completed', 2]],
            ['preloved', 'A4 expanding file', 85, 'Twelve tabs for sorting class readings and handouts.', ['completed', 2]],
            ['preloved', 'Adjustable desk lamp', 375, 'Small warm-white lamp with a weighted base.', ['accepted', 1]],
            ['preloved', 'Foldable laptop riser', 290, 'Aluminum riser for a 13- to 15-inch laptop.', ['completed', 35]],
            ['preloved', 'Insulated lunch tote', 140, 'Clean zipped tote that fits a standard food container.'],
        ]],
        'thread-and-paper' => ['RIVERSIDE', 'Thread & Paper', 'Handmade stationery and small fabric goods.', [
            ['handmade', 'Canvas pencil pouch', 95, 'Lined canvas pouch with space for a short ruler.', ['completed', 5]],
            ['handmade', 'Pressed-flower bookmark', 50, 'Laminated bookmark with pressed leaves and a cotton tassel.', ['negotiating', 1]],
            ['handmade', 'Pocket sketchbook', 130, 'Hand-bound booklet with uncoated pages for pencil sketches.', ['completed', 40]],
            ['handmade', 'Macrame bag charm', 65, 'Cotton cord charm with a small metal clasp.'],
            ['handmade', 'Fabric book sleeve', 155, 'Padded sleeve for a paperback or small planner.'],
        ]],
        'cedar-creative' => ['CEDAR', 'Cedar Creative', 'Layout help for student organizations and class projects.', [
            ['design', 'Campus event poster layout', 350, 'A print-ready poster with one round of edits.', ['completed', 2]],
            ['design', 'Research poster formatting', 320, 'Layout for supplied research text, charts and captions.', ['for_meetup', 2]],
            ['design', 'Student portfolio cover layout', 210, 'Editable cover design for a PDF portfolio.', ['completed', 46]],
            ['design', 'Presentation slide template', 275, 'A set of editable slides with matching typography.'],
            ['design', 'Club social post graphics', 225, 'Two square layouts using the club’s supplied copy and colors.'],
        ]],
        'cedar-tech' => ['CEDAR', 'Cedar Tech Bench', 'Practical laptop and software help for students.', [
            ['tech', 'Laptop storage cleanup session', 240, 'Guided cleanup and advice on organizing backups.', ['completed', 4]],
            ['tech', 'Spreadsheet formula clinic', 180, 'Thirty minutes of guided practice with spreadsheet formulas.', ['cancelled', 1]],
            ['tech', 'Document backup setup', 160, 'Help creating a simple backup routine for class files.', ['completed', 45]],
            ['tech', 'Email and calendar setup', 120, 'Help organizing folders and setting up class reminders.'],
            ['tech', 'Printer connection troubleshooting', 150, 'A basic check of drivers and settings for an existing printer.'],
        ]],
    ];

    public function run(PasswordHasher $passwords, ListingStock $stock): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('The university dashboard demo seed is limited to local and testing environments.');
        }

        DB::transaction(function () use ($passwords, $stock) {
            $email = 'admin@'.self::EMAIL_DOMAIN;
            $admin = User::query()->where('email', $email)->lockForUpdate()->first();
            if ($admin !== null) {
                if (! $admin->roles()->where('role', 'university_admin')->whereNull('campusId')->exists()) {
                    throw new RuntimeException('The dashboard demo admin email is already in use.');
                }

                return;
            }

            // This account and the fixtures commit together, so it also marks a completed seed.
            $admin = User::create([
                'email' => $email,
                'displayName' => 'Dashboard Demo Admin',
                'passwordHash' => $passwords->hash(self::ADMIN_PASSWORD),
                'status' => 'active',
            ]);
            UserRole::create(['userId' => $admin->id, 'role' => 'university_admin', 'campusId' => null]);

            $campuses = [];
            foreach (self::CAMPUSES as $key => $name) {
                $campuses[$key] = Campus::query()->firstOrCreate(['code' => 'DASH-DEMO-'.$key], [
                    'name' => "Demo {$name} Campus",
                    'active' => true,
                ]);
            }

            $categories = [];
            foreach (self::CATEGORIES as $key => [$name, $type]) {
                $categories[$key] = Category::query()->firstOrCreate(['name' => $name, 'listingType' => $type], ['policyRiskLevel' => 0]);
            }

            $anchor = CarbonImmutable::now('Asia/Manila')->subDay()->startOfDay()->addHours(9)->utc();
            $studentHash = $passwords->hash(bin2hex(random_bytes(24)));
            $buyers = [];
            foreach (['RIVERSIDE', 'CEDAR'] as $campusKey) {
                foreach (['Library Buyer', 'Workshop Buyer', 'Dorm Buyer'] as $index => $name) {
                    $buyers[$campusKey][] = $this->student(
                        strtolower($campusKey).'-buyer-'.($index + 1),
                        "Demo {$name}",
                        $campuses[$campusKey],
                        $studentHash,
                        $anchor->subDays([50, 6, 6][$index]),
                    );
                }
            }

            foreach (self::STORES as $key => [$campusKey, $name, $description, $items]) {
                $campus = $campuses[$campusKey];
                $storeCreatedAt = $anchor->subDays(3 + max(array_map(fn (array $item) => $item[4][1] ?? 0, $items)));
                $owner = $this->student($key, "Demo {$name} Seller", $campus, $studentHash, $storeCreatedAt->subDay());
                $store = SellerProfile::create([
                    'ownerUserId' => $owner->id, 'campusId' => $campus->id, 'storeName' => $name,
                    'description' => $description,
                    'sellerType' => 'student',
                    'approvalStatus' => 'approved',
                    'createdAt' => $storeCreatedAt,
                ]);

                foreach ($items as $index => $item) {
                    [$category, $title, $price, $description] = $item;
                    [$type, $basis] = array_slice(self::CATEGORIES[$category], 1);
                    $order = $item[4] ?? null;
                    $createdAt = $anchor->subDays(($order[1] ?? $index) + 1)->max($storeCreatedAt);
                    $listing = Listing::create([
                        'sellerProfileId' => $store->id,
                        'title' => $title,
                        'campusId' => $campus->id,
                        'categoryId' => $categories[$category]->id,
                        'type' => $type,
                        'description' => $description,
                        'price' => $price,
                        'priceBasis' => $basis,
                        'currency' => 'PHP',
                        'availabilityState' => 'available',
                        'condition' => match ($category) {
                            'handmade' => 'new',
                            'books', 'preloved' => $index % 2 === 0 ? 'good' : 'like_new',
                            default => null,
                        },
                        'handoffNote' => 'Meet at the campus library entrance.',
                        'status' => 'published',
                        'createdAt' => $createdAt,
                        'updatedAt' => $createdAt->addHours(2),
                    ]);

                    ListingReview::create([
                        'listingId' => $listing->id,
                        'reviewerId' => $admin->id,
                        'decision' => 'approved',
                        'reason' => 'Approved for the synthetic dashboard demonstration.',
                        'createdAt' => $createdAt->addHours(2),
                    ]);
                    if ($type === 'physical_product') {
                        ListingInventory::create(['listingId' => $listing->id, 'availableQuantity' => 2 + $index]);
                    }
                    if ($order !== null) {
                        [$status, $daysAgo] = $order;
                        $buyer = $buyers[$campusKey][$daysAgo >= 5 ? 0 : $index % 3];
                        $startedAt = $anchor->subDays($daysAgo)->addMinutes(11 * $index);
                        $this->order($listing, $owner, $buyer, $status, $startedAt, $stock);
                    }
                }
            }
        }, attempts: 3);

        $this->command?->info('University dashboard demo fixtures are ready.');
    }

    private function student(string $email, string $name, Campus $campus, string $passwordHash, CarbonImmutable $verifiedAt): User
    {
        $student = User::create([
            'email' => $email.'@'.self::EMAIL_DOMAIN,
            'displayName' => $name,
            'passwordHash' => $passwordHash,
            'status' => 'active',
        ]);
        Affiliation::create([
            'userId' => $student->id,
            'campusId' => $campus->id,
            'verificationStatus' => 'verified',
            'verifiedAt' => $verifiedAt,
        ]);

        return $student;
    }

    private function order(Listing $listing, User $seller, User $buyer, string $status, CarbonImmutable $startedAt, ListingStock $stock): void
    {
        $thread = InquiryThread::create([
            'listingId' => $listing->id,
            'buyerUserId' => $buyer->id,
            'sellerProfileId' => $listing->sellerProfileId,
            'createdAt' => $startedAt,
        ]);
        $steps = [
            ['requested', $buyer, 'pending', $startedAt],
            ['accepted', $seller, 'accepted', $startedAt->addMinutes(20)],
            ['negotiating', $buyer, 'negotiating', $startedAt->addMinutes(30)],
            ['meetup_location_shared', $seller, 'negotiating', $startedAt->addMinutes(35)],
            ['meetup_confirmed', $buyer, 'negotiating', $startedAt->addMinutes(40)],
            ['meetup_confirmed', $seller, 'for_meetup', $startedAt->addMinutes(50)],
            ['completion_confirmed', $buyer, 'for_meetup', $startedAt->addHours(2)],
            ['completion_confirmed', $seller, 'completed', $startedAt->addHours(3)],
        ];
        $stepCount = match ($status) {
            'pending', 'cancelled' => 1,
            'accepted' => 2,
            'negotiating' => 5,
            'for_meetup' => 6,
            'completed' => 8,
        };
        $history = array_slice($steps, 0, $stepCount);
        if ($status === 'cancelled') {
            $history[] = ['rejected', $seller, 'cancelled', $startedAt->addMinutes(15), 'The requested session time is unavailable.'];
        }

        $order = Transaction::create([
            'inquiryThreadId' => $thread->id,
            'activeThreadId' => in_array($status, ['completed', 'cancelled'], true) ? null : $thread->id,
            'listingId' => $listing->id,
            'buyerUserId' => $buyer->id,
            'sellerUserId' => $seller->id,
            'status' => $status,
            'price' => $listing->getRawOriginal('price'),
            'currency' => $listing->currency,
            'buyerMeetupConfirmedAt' => $history[4][3] ?? null,
            'sellerMeetupConfirmedAt' => $history[5][3] ?? null,
            'buyerCompletionConfirmedAt' => $history[6][3] ?? null,
            'sellerCompletionConfirmedAt' => $history[7][3] ?? null,
            'createdAt' => $startedAt,
            'updatedAt' => end($history)[3],
        ]);

        if ($stepCount >= 4) {
            Handoff::create([
                'inquiryThreadId' => $thread->id,
                'method' => 'campus_pickup',
                'timeWindow' => $startedAt->addHours(2)->setTimezone('Asia/Manila')->format('M j, g:i A').' (campus time)',
                'generalLocation' => 'Campus library entrance',
                'status' => match ($status) {
                    'completed' => 'completed',
                    'for_meetup' => 'agreed',
                    default => 'proposed',
                },
                'createdAt' => $steps[3][3],
            ]);
        }

        $previous = null;
        foreach ($history as $step) {
            [$event, $actor, $next, $occurredAt] = $step;
            TransactionStatusLog::create([
                'transactionId' => $order->id,
                'actorUserId' => $actor->id,
                'fromStatus' => $previous,
                'toStatus' => $next,
                'event' => $event,
                'reason' => $step[4] ?? null,
                'createdAt' => $occurredAt,
            ]);
            $previous = $next;
        }

        if ($listing->type->value === 'physical_product' && $stepCount >= 2) {
            $stock->hold($listing->id);
            if ($status === 'completed') {
                $stock->complete($listing->id, $order->id);
            }
        }
    }
}
