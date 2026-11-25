<?php

namespace Tests\Unit;

use App\Services\Analytics\DashboardPrivacy;
use PHPUnit\Framework\TestCase;

class DashboardPrivacyTest extends TestCase
{
    public function test_counts_mask_positive_groups_below_five(): void
    {
        $this->assertSame([0, '<5', '<5', 5, 100000], array_map(DashboardPrivacy::maskCount(...), [0, 1, 4, 5, 100000]));
    }

    public function test_reported_sales_require_at_least_five_contributing_orders(): void
    {
        $this->assertNull(DashboardPrivacy::maskPeso(0, 0));
        $this->assertNull(DashboardPrivacy::maskPeso(200.25, 4));
        $this->assertSame(750.25, DashboardPrivacy::maskPeso(750.25, 5));
    }

    public function test_percent_changes_require_a_publishable_count_in_both_periods(): void
    {
        $this->assertNull(DashboardPrivacy::safeChange(5, null));
        $this->assertNull(DashboardPrivacy::safeChange(5, 0));
        $this->assertNull(DashboardPrivacy::safeChange(5, 4));
        $this->assertNull(DashboardPrivacy::safeChange(4, 5));
        $this->assertSame(12.0, DashboardPrivacy::safeChange(28, 25));
        $this->assertSame(-50.0, DashboardPrivacy::safeChange(5, 10));
    }
}
