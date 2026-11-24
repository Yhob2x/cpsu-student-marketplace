import type { Prisma } from '@prisma/client';
import { reviewCampusIds, type AuthUser } from './permissions.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

// MariaDB does not implement native PostgreSQL RLS. These Prisma predicates
// enforce row ownership and campus visibility at query time, not in the UI.
// Every private route must authenticate before using an actor-scoped predicate.
export const rowAccess = {
  storeOwner: (actorId: number): Prisma.SellerProfileWhereInput => ({
    ownerUserId: actorId,
  }),
  listingOwner: (actorId: number): Prisma.ListingWhereInput => ({
    seller: { ownerUserId: actorId },
  }),
  notificationOwner: (actorId: number): Prisma.NotificationWhereInput => ({
    userId: actorId,
  }),
  savedListingOwner: (actorId: number): Prisma.SavedListingWhereInput => ({
    userId: actorId,
  }),
  inquiryParticipant: (actorId: number): Prisma.InquiryThreadWhereInput => ({
    OR: [{ buyerUserId: actorId }, { seller: { ownerUserId: actorId } }],
  }),
  transactionParticipant: (actorId: number): Prisma.TransactionWhereInput => ({
    OR: [{ buyerUserId: actorId }, { sellerUserId: actorId }],
  }),
  publicListing: (): Prisma.ListingWhereInput => ({
    status: 'published',
    deletedAt: null,
    seller: visibleStudentStoreWhere(),
  }),
  reviewListing: (actor: AuthUser): Prisma.ListingWhereInput => {
    const campuses = reviewCampusIds(actor);
    return campuses === 'all' ? {} : { campusId: { in: campuses } };
  },
  reviewAffiliation: (actor: AuthUser): Prisma.AffiliationWhereInput => {
    const campuses = reviewCampusIds(actor);
    return campuses === 'all' ? {} : { campusId: { in: campuses } };
  },
  reviewTransaction: (actor: AuthUser): Prisma.TransactionWhereInput => {
    const campuses = reviewCampusIds(actor);
    return campuses === 'all' ? {} : { listing: { campusId: { in: campuses } } };
  },
};

// Public, owner, or an authorized reviewer may see a listing and its photos.
// Missing identity does not add a private-access branch. Campus staff with no
// assigned campus never receive a wildcard review scope.
export function visibleListingRows(actor: AuthUser | undefined): Prisma.ListingWhereInput {
  if (!actor) return rowAccess.publicListing();
  const campuses = reviewCampusIds(actor);
  if (campuses === 'all') return {}; // Global university review scope.
  const review = campuses.length ? [rowAccess.reviewListing(actor)] : [];
  return { OR: [rowAccess.publicListing(), rowAccess.listingOwner(actor.id), ...review] };
}
