import type { PrismaClient } from '@prisma/client';
import { HttpError } from './http.js';

export type ListingStock = { stockQuantity: number; reservedQuantity: number };
type Db = Pick<PrismaClient, 'listingInventory'>;

export const missingInventoryTable = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error &&
  ['P2021', 'P2022'].includes(String((error as { code: unknown }).code));

// Optional until the additive inventory migration is explicitly activated.
// Do not turn unknown inventory into an invented 1 or zero.
export async function inventoryAvailable(db: Db): Promise<boolean> {
  if (!(db as Partial<Db>).listingInventory) {
    // An old generated client must never silently switch back to one-off stock
    // semantics once the inventory table is active.
    const inspect = (db as Partial<PrismaClient>).$queryRawUnsafe;
    if (typeof inspect !== 'function') return false; // Synthetic test doubles.
    const rows = await inspect.call(db, "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ListingInventory' LIMIT 1") as unknown[];
    if (rows.length) throw new HttpError(503, 'stock_not_ready');
    return false;
  }
  try {
    await db.listingInventory.findFirst({ select: { listingId: true } });
    return true;
  } catch (error) {
    if (missingInventoryTable(error)) return false;
    throw error;
  }
}

export async function readListingStocks(db: Db, ids: readonly number[]): Promise<Map<number, ListingStock> | null> {
  if (!ids.length) return new Map();
  if (!(db as Partial<Db>).listingInventory) return null;
  try {
    const rows = await db.listingInventory.findMany({
      where: { listingId: { in: [...new Set(ids)] } },
      select: { listingId: true, availableQuantity: true, reservedQuantity: true },
    });
    return new Map(rows.map(row => [row.listingId, {
      stockQuantity: row.availableQuantity, reservedQuantity: row.reservedQuantity,
    }]));
  } catch (error) {
    if (missingInventoryTable(error)) return null;
    throw error;
  }
}
