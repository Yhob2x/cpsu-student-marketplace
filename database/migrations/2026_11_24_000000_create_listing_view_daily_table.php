<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unique listing views per campus-local day (Asia/Manila), so sellers can see
 * views over time. Counting starts when this table exists; earlier views stay
 * only in the all-time ListingViewCounter.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ListingViewDaily')) {
            return;
        }

        Schema::create('ListingViewDaily', function (Blueprint $table) {
            $table->integer('listingId');
            $table->date('day');
            $table->unsignedInteger('viewCount')->default(0);
            $table->primary(['listingId', 'day']);
            $table->index('day', 'ListingViewDaily_day_idx');
            $table->foreign('listingId', 'ListingViewDaily_listingId_fkey')->references('id')->on('Listing')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ListingViewDaily');
    }
};
