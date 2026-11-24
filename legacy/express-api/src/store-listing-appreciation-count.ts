import type { PrismaClient } from '@prisma/client';
import { missingInventoryTable } from './listing-inventory.js';

/** Count rows, not stores or unique users, across all published listings.
 * Unpublished and deleted listings must never contribute to the public total.
 * Null means table/client not activated; never misrepresent unavailable as zero.
 */
export async function readStoreListingAppreciationCount(
  db: Pick<PrismaClient, 'listingAppreciation'>, sellerProfileId: number,
): Promise<number | null> {
  if (!(db as Partial<typeof db>).listingAppreciation) return null;
  try {
    return await db.listingAppreciation.count({
      where: { listing: { sellerProfileId, status: 'published', deletedAt: null } },
    });
  } catch (error) {
    if (missingInventoryTable(error)) return null;
    throw error;
  }
}
