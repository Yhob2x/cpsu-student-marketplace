<?php

namespace App\Services;

use App\Models\Listing;
use App\Models\ListingInventory;
use App\Support\ApiError;
use Illuminate\Support\Facades\DB;

/** Each accepted product transaction holds one unit. Conditional updates settle competing buyers. */
class ListingStock
{
    public function hold(int $listingId): void
    {
        $this->stockOrFail($listingId);
        $live = fn () => Listing::query()->whereKey($listingId)->where('status', 'published')->whereNull('deletedAt')->where('availabilityState', 'available');
        if (! $live()->exists()) {
            throw new ApiError(409, 'listing_unavailable');
        }

        $reserved = ListingInventory::query()->where('listingId', $listingId)->where('availableQuantity', '>', 0)->update([
            'availableQuantity' => DB::raw('`availableQuantity` - 1'),
            'reservedQuantity' => DB::raw('`reservedQuantity` + 1'),
        ]);
        if ($reserved !== 1) {
            throw new ApiError(409, 'out_of_stock');
        }

        if (ListingInventory::query()->findOrFail($listingId)->availableQuantity === 0
            && $live()->update(['availabilityState' => 'reserved', 'availability' => 'reserved']) !== 1) {
            throw new ApiError(409, 'listing_unavailable');
        }
    }

    public function complete(int $listingId, int $transactionId): void
    {
        $this->stockOrFail($listingId);
        $changed = ListingInventory::query()->where('listingId', $listingId)->where('reservedQuantity', '>', 0)
            ->update(['reservedQuantity' => DB::raw('`reservedQuantity` - 1')]);
        if ($changed === 0) {
            throw new ApiError(409, 'reservation_changed');
        }

        $current = ListingInventory::query()->findOrFail($listingId);
        $availability = $current->availableQuantity > 0 ? 'available' : ($current->reservedQuantity > 0 ? 'reserved' : 'sold');
        if ($this->ownReservation($listingId, $transactionId)->update(['availabilityState' => $availability, 'availability' => $availability, 'reservationTransactionId' => null]) === 0) {
            throw new ApiError(409, 'reservation_changed');
        }
    }

    public function release(int $listingId, int $transactionId): void
    {
        $this->stockOrFail($listingId);
        $updated = ListingInventory::query()->where('listingId', $listingId)->where('reservedQuantity', '>', 0)->update([
            'reservedQuantity' => DB::raw('`reservedQuantity` - 1'),
            'availableQuantity' => DB::raw('`availableQuantity` + 1'),
        ]);
        if ($updated === 0) {
            throw new ApiError(409, 'reservation_changed');
        }

        if ($this->ownReservation($listingId, $transactionId)->update(['reservationTransactionId' => null, 'availabilityState' => 'available', 'availability' => 'available']) === 0) {
            throw new ApiError(409, 'reservation_changed');
        }
    }

    private function stockOrFail(int $listingId): void
    {
        if (! ListingInventory::query()->whereKey($listingId)->exists()) {
            throw new ApiError(409, 'stock_record_missing');
        }
    }

    private function ownReservation(int $listingId, int $transactionId)
    {
        return Listing::query()->whereKey($listingId)
            ->where(fn ($query) => $query->whereNull('reservationTransactionId')->orWhere('reservationTransactionId', $transactionId));
    }
}
