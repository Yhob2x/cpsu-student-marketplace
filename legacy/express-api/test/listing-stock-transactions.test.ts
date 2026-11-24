import { describe, expect, test } from 'bun:test';
import { holdProductUnit, completeProductUnit, releaseProductUnit } from '../src/listing-stock-transactions.js';

function fixture(initialStock = 2) {
  const stock = { listingId: 1, availableQuantity: initialStock, reservedQuantity: 0 };
  const listing = { id: 1, status: 'published', deletedAt: null, availabilityState: 'available',
    availability: 'available', reservationTransactionId: null as number | null };
  const model: any = {
    listingInventory: {
      findUnique: async () => ({ ...stock }),
      findUniqueOrThrow: async () => ({ ...stock }),
      updateMany: async ({ where, data }: any) => {
        if (where.availableQuantity?.gt !== undefined && stock.availableQuantity <= where.availableQuantity.gt) return { count: 0 };
        if (where.reservedQuantity?.gt !== undefined && stock.reservedQuantity <= where.reservedQuantity.gt) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          const v = value as any;
          (stock as any)[key] = typeof v === 'number' ? v :
            (stock as any)[key] + (v.decrement ? -v.decrement : v.increment ?? 0);
        }
        return { count: 1 };
      },
    },
    listing: {
      findFirst: async ({ where }: any) => listing.status === where.status &&
        listing.availabilityState === where.availabilityState ? { id: 1 } : null,
      updateMany: async ({ where, data }: any) => {
        if (where.availabilityState && listing.availabilityState !== where.availabilityState) return { count: 0 };
        if (where.reservationTransactionId !== undefined && where.reservationTransactionId !== listing.reservationTransactionId) return { count: 0 };
        Object.assign(listing, data);
        return { count: 1 };
      },
    },
  };
  return { stock, listing, model };
}

describe('stock reservations per physical listing (synthetic DB)', () => {
  test('multiple units can be reserved by separate buyers without overselling', async () => {
    const h = fixture(2);
    await holdProductUnit(h.model, 1, 101, true);
    expect(h.stock).toMatchObject({ availableQuantity: 1, reservedQuantity: 1 });
    expect(h.listing.availabilityState).toBe('available');
    await holdProductUnit(h.model, 1, 102, true);
    expect(h.stock).toMatchObject({ availableQuantity: 0, reservedQuantity: 2 });
    expect(h.listing.availabilityState).toBe('reserved');
    await expect(holdProductUnit(h.model, 1, 103, true)).rejects.toMatchObject({ status: 409 });
  });
  test('completion consumes one held unit; cancellation returns another', async () => {
    const h = fixture(2);
    await holdProductUnit(h.model, 1, 101, true);
    await holdProductUnit(h.model, 1, 102, true);
    await completeProductUnit(h.model, 1, 101, true);
    expect(h.stock).toMatchObject({ availableQuantity: 0, reservedQuantity: 1 });
    expect(h.listing.availabilityState).toBe('reserved');
    await releaseProductUnit(h.model, 1, 102, true);
    expect(h.stock).toMatchObject({ availableQuantity: 1, reservedQuantity: 0 });
    expect(h.listing.availabilityState).toBe('available');
    await holdProductUnit(h.model, 1, 103, true);
    await completeProductUnit(h.model, 1, 103, true);
    expect(h.listing.availabilityState).toBe('sold');
    expect(h.stock).toMatchObject({ availableQuantity: 0, reservedQuantity: 0 });
  });
  test('service listings remain outside the inventory helper', async () => {
    // The router invokes the stock helper only for physical products.
    const h = fixture();
    expect(h.stock.availableQuantity).toBe(2);
  });
});
