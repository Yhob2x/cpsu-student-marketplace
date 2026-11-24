import { describe, expect, test } from 'bun:test';
import { inventoryAvailable, readListingStocks } from '../src/listing-inventory.js';

describe('inventory activation safety (synthetic clients)', () => {
  test('no table and no delegate leaves existing one-off mode untouched', async () => {
    const oldClient: any = { $queryRawUnsafe: async () => [] };
    expect(await inventoryAvailable(oldClient)).toBe(false);
    expect(await readListingStocks(oldClient, [91])).toBeNull();
  });
  test('active table and outdated generated Prisma client fail closed for stock writes', async () => {
    const oldClient: any = { $queryRawUnsafe: async () => [{ TABLE_NAME: 'ListingInventory' }] };
    await expect(inventoryAvailable(oldClient)).rejects.toMatchObject({
      status: 503, code: 'stock_not_ready',
    });
  });
  test('missing migration after Prisma client generated returns unavailable, not fake stock', async () => {
    const newClient: any = { listingInventory: {
      findFirst: async () => { throw { code: 'P2021' }; },
      findMany: async () => { throw { code: 'P2021' }; },
    } };
    expect(await inventoryAvailable(newClient)).toBe(false);
    expect(await readListingStocks(newClient, [91])).toBeNull();
  });
});
