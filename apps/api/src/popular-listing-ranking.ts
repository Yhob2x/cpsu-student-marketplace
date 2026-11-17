import type { Prisma } from '@prisma/client';

// Popular is the number of saved-listing relationships (not sales or views).
// The stable ID tie-break prevents similarly saved listings changing order on reload.
export const popularListingOrderBy = [
  { savedListings: { _count: 'desc' as const } },
  { id: 'desc' as const },
] satisfies Prisma.ListingOrderByWithRelationInput[];
