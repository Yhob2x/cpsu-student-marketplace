import { Prisma } from '@prisma/client';

// The approval record is the moment a listing enters the public marketplace.
// Keep this query fixed: it has no client-provided SQL or parameters.
export const freshListingIdsQuery = Prisma.sql`
  SELECT l.id
  FROM \`Listing\` AS l
  JOIN \`SellerProfile\` AS s ON s.id = l.sellerProfileId
  JOIN \`User\` AS u ON u.id = s.ownerUserId
  LEFT JOIN (
    SELECT listingId, MAX(createdAt) AS approvedAt
    FROM \`ListingReview\`
    WHERE decision = 'approved'
    GROUP BY listingId
  ) AS reviews ON reviews.listingId = l.id
  WHERE l.status = 'published' AND l.availabilityState = 'available'
    AND l.deletedAt IS NULL AND s.approvalStatus = 'approved'
    AND u.status = 'active'
  ORDER BY COALESCE(reviews.approvedAt, l.createdAt) DESC, l.id DESC
  LIMIT 24
`;
