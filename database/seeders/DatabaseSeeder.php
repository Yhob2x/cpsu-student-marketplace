<?php

namespace Database\Seeders;

use App\Models\Affiliation;
use App\Models\Campus;
use App\Models\CampusPolicy;
use App\Models\Category;
use App\Models\RestrictedCategory;
use App\Models\User;
use App\Models\UserRole;
use App\Services\PasswordHasher;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use RuntimeException;

/**
 * Development seed, ported from apps/api/prisma/seed.ts. Campuses, categories and demo
 * accounts are placeholders that must be replaced with approved CPSU data. Safe to rerun.
 */
class DatabaseSeeder extends Seeder
{
    private const DEV_PASSWORD = 'DevPassword!123';

    private const CAMPUSES = [
        ['MAIN', 'Main Campus'], ['CAUAYAN', 'Cauayan Campus'], ['HINOBAAN', 'Hinobaan Campus'],
        ['ILOG', 'Ilog Campus'], ['SIPALAY', 'Sipalay Campus'], ['CANDONI', 'Candoni Campus'],
    ];

    private const CATEGORIES = [
        ['Handmade goods', 'physical_product', 0], ['Pre-loved items', 'physical_product', 0], ['Books & notes (pre-loved)', 'physical_product', 0],
        ['Food & drinks', 'physical_product', 2], ['Printing & school supplies', 'physical_product', 2],
        ['Design & creative', 'service', 0], ['Tutoring', 'service', 1], ['Tech & IT help', 'service', 0], ['Photography & video', 'service', 0],
    ];

    private const PEOPLE = [
        ['seller@dev.test', 'Demo Seller', null],
        ['buyer@dev.test', 'Demo Buyer', null],
        ['reviewer@dev.test', 'Cauayan Reviewer', 'campus_reviewer'],
        ['admin@dev.test', 'University Admin', 'university_admin'],
    ];

    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('Refusing to seed demo data in production.');
        }

        foreach (self::CAMPUSES as [$code, $name]) {
            Campus::query()->firstOrCreate(['code' => $code], ['name' => $name]);
        }
        foreach (self::CATEGORIES as [$name, $type, $risk]) {
            if (! Category::query()->where('name', $name)->exists()) {
                Category::create(['name' => $name, 'listingType' => $type, 'policyRiskLevel' => $risk]);
            }
        }

        $food = Category::query()->where('name', 'Food & drinks')->firstOrFail();
        foreach (Campus::query()->get() as $campus) {
            $policy = CampusPolicy::query()->firstOrCreate(['campusId' => $campus->id, 'version' => 1], [
                'effectiveDate' => Carbon::now(), 'approvedBy' => 'PLACEHOLDER - pending CPSU approval', 'documentRef' => 'docs/campus-policy-rules.md',
            ]);
            if (! RestrictedCategory::query()->where('campusId', $campus->id)->where('categoryId', $food->id)->exists()) {
                RestrictedCategory::create(['campusId' => $campus->id, 'categoryId' => $food->id, 'policyAction' => 'review', 'policyVersionId' => $policy->id]);
            }
        }

        $hash = app(PasswordHasher::class)->hash(self::DEV_PASSWORD);
        $cauayan = Campus::query()->where('code', 'CAUAYAN')->firstOrFail();
        foreach (self::PEOPLE as [$email, $displayName, $role]) {
            $user = User::query()->firstOrCreate(['email' => $email], ['displayName' => $displayName, 'passwordHash' => $hash]);
            // New staff identities must not also receive a student affiliation.
            if ($role === null) {
                Affiliation::query()->firstOrCreate(['userId' => $user->id, 'campusId' => $cauayan->id], ['verificationStatus' => 'verified', 'verifiedAt' => Carbon::now()]);
            } elseif (! UserRole::query()->where('userId', $user->id)->where('role', $role)->exists()) {
                UserRole::create(['userId' => $user->id, 'role' => $role, 'campusId' => $role === 'university_admin' ? null : $cauayan->id]);
            }
        }

        $this->command?->info('Seeded. Dev accounts: seller@/buyer@/reviewer@/admin@dev.test, password '.self::DEV_PASSWORD);
    }
}
