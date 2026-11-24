import type { Prisma } from '@prisma/client';
import { HttpError } from './http.js';

// Each accepted physical-product transaction reserves exactly one unit.
// InnoDB conditional UPDATE provides one row-level compare-and-swap for competing buyers.
export async function holdProductUnit(tx: Prisma.TransactionClient, listingId: number, transactionId: number, inventoryEnabled: boolean) {
  const stock = inventoryEnabled ? await tx.listingInventory.findUnique({ where: { listingId } }) : null;
  if (inventoryEnabled && !stock) throw new HttpError(409, 'stock_record_missing');
  if (!stock) {
    const reserved = await tx.listing.updateMany({ where: {
      id: listingId, status: 'published', deletedAt: null, availabilityState: 'available',
      reservationTransactionId: null,
    }, data: { availabilityState: 'reserved', availability: 'reserved', reservationTransactionId: transactionId } });
    if (!reserved.count) throw new HttpError(409, 'listing_unavailable');
    return;
  }
  const listing = await tx.listing.findFirst({ where: {
    id: listingId, status: 'published', deletedAt: null, availabilityState: 'available',
  }, select: { id: true } });
  if (!listing) throw new HttpError(409, 'listing_unavailable');
  const reserved = await tx.listingInventory.updateMany({ where: {
    listingId, availableQuantity: { gt: 0 },
  }, data: { availableQuantity: { decrement: 1 }, reservedQuantity: { increment: 1 } } });
  if (reserved.count !== 1) throw new HttpError(409, 'out_of_stock');
  const remaining = await tx.listingInventory.findUniqueOrThrow({ where: { listingId } });
  if (remaining.availableQuantity === 0) {
    const hidden = await tx.listing.updateMany({ where: {
      id: listingId, status: 'published', deletedAt: null, availabilityState: 'available',
    }, data: { availabilityState: 'reserved', availability: 'reserved' } });
    if (hidden.count !== 1) throw new HttpError(409, 'listing_unavailable');
  }
}

export async function completeProductUnit(tx: Prisma.TransactionClient, listingId: number, transactionId: number, inventoryEnabled: boolean) {
  const stock = inventoryEnabled ? await tx.listingInventory.findUnique({ where: { listingId } }) : null;
  if (inventoryEnabled && !stock) throw new HttpError(409, 'stock_record_missing');
  if (!stock) {
    const sold = await tx.listing.updateMany({ where: {
      id: listingId, availabilityState: 'reserved', reservationTransactionId: transactionId,
    }, data: { availabilityState: 'sold', availability: 'sold', reservationTransactionId: null } });
    if (sold.count !== 1) throw new HttpError(409, 'reservation_changed');
    return;
  }
  const changed = await tx.listingInventory.updateMany({ where: {
    listingId, reservedQuantity: { gt: 0 },
  }, data: { reservedQuantity: { decrement: 1 } } });
  if (!changed.count) throw new HttpError(409, 'reservation_changed');
  const current = await tx.listingInventory.findUniqueOrThrow({ where: { listingId } });
  const availability = current.availableQuantity > 0 ? 'available' :
    current.reservedQuantity > 0 ? 'reserved' : 'sold';
  const updated = await tx.listing.updateMany({ where: {
    id: listingId, ...(stock ? { OR: [{ reservationTransactionId: null }, { reservationTransactionId: transactionId }] } : {}),
  }, data: { availabilityState: availability, availability, reservationTransactionId: null } });
  if (!updated.count) throw new HttpError(409, 'reservation_changed');
}

export async function releaseProductUnit(tx: Prisma.TransactionClient, listingId: number, transactionId: number, inventoryEnabled: boolean) {
  const stock = inventoryEnabled ? await tx.listingInventory.findUnique({ where: { listingId } }) : null;
  if (inventoryEnabled && !stock) throw new HttpError(409, 'stock_record_missing');
  if (!stock) {
    const released = await tx.listing.updateMany({ where: {
      id: listingId, reservationTransactionId: transactionId, availabilityState: 'reserved',
    }, data: { reservationTransactionId: null, availabilityState: 'available', availability: 'available' } });
    if (!released.count) throw new HttpError(409, 'reservation_changed');
    return;
  }
  const updated = await tx.listingInventory.updateMany({ where: {
    listingId, reservedQuantity: { gt: 0 },
  }, data: { reservedQuantity: { decrement: 1 }, availableQuantity: { increment: 1 } } });
  if (!updated.count) throw new HttpError(409, 'reservation_changed');
  const released = await tx.listing.updateMany({ where: {
    id: listingId, OR: [{ reservationTransactionId: null }, { reservationTransactionId: transactionId }],
  }, data: { reservationTransactionId: null, availabilityState: 'available', availability: 'available' } });
  if (!released.count) throw new HttpError(409, 'reservation_changed');
}
