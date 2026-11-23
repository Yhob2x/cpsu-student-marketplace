import { Prisma, type PrismaClient } from '@prisma/client';
import { missingViewStorage } from './listing-views.js';

export type PopularRankingMode = 'appreciations_and_views' | 'appreciations_only' | 'unavailable';

// Views have logarithmic weight so repeated browsing cannot overwhelm
// genuine student appreciations. Engagement ages with a 30-day half-life.
export const popularListingScore = (appreciations: number, views: number, ageHours: number): number =>
  (4 * Math.max(0, appreciations) + Math.log2(1 + Math.max(0, views))) /
  (1 + Math.max(0, ageHours) / 720);

// Database-wide ranking BEFORE LIMIT 8; never rank only Home's current cards.
// User saves, store followers and store-level appreciations are excluded.
// Optional view storage allows an appreciations-only ranking before activation.
export function popularListingIdsQuery(withViews: boolean): Prisma.Sql {
  const viewJoin = withViews ? Prisma.sql`
    LEFT JOIN ListingViewCounter AS views ON views.listingId = l.id
  ` : Prisma.empty;
  const views = withViews ? Prisma.sql`COALESCE(views.viewCount, 0)` : Prisma.sql`0`;
  const likes = Prisma.sql`COALESCE(likes.total, 0)`;

  return Prisma.sql`
    SELECT l.id
    FROM Listing AS l
    JOIN SellerProfile AS s ON s.id = l.sellerProfileId
    JOIN User AS owner ON owner.id = s.ownerUserId
    LEFT JOIN (
      SELECT listingId, COUNT(*) AS total
      FROM ListingAppreciation
      GROUP BY listingId
    ) AS likes ON likes.listingId = l.id
    ${viewJoin}
    WHERE l.status = 'published'
      AND l.availabilityState = 'available'
      AND l.deletedAt IS NULL
      AND s.approvalStatus = 'approved'
      AND s.sellerType = 'student'
      AND owner.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM UserRole AS role
        WHERE role.userId = owner.id
      )
      AND EXISTS (
        SELECT 1
        FROM Affiliation AS affiliation
        JOIN Campus AS campus ON campus.id = affiliation.campusId
        WHERE affiliation.userId = owner.id
          AND affiliation.verificationStatus = 'verified'
          AND campus.active = 1
          AND (affiliation.expirationAt IS NULL OR affiliation.expirationAt > UTC_TIMESTAMP())
      )
      AND (${likes} + ${views}) > 0
    ORDER BY
      ((4 * ${likes} + LOG2(1 + ${views})) /
        (1 + GREATEST(0, TIMESTAMPDIFF(HOUR, l.createdAt, UTC_TIMESTAMP())) / 720.0)) DESC,
      ${likes} DESC, ${views} DESC, l.createdAt DESC, l.id DESC
    LIMIT 8
  `;
}

function missingAppreciationTable(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (['P2021', 'P2022'].includes(String(error.code))) return true;
  if (error.code !== 'P2010' || !('meta' in error)) return false;
  const meta = error.meta;
  return Boolean(meta && typeof meta === 'object' && 'code' in meta
    && String(meta.code) === '1146' && 'message' in meta
    && /ListingAppreciation/i.test(String(meta.message)));
}

export async function readPopularListingIds(db: Pick<PrismaClient, '$queryRaw'>):
  Promise<{ ids: number[]; ranking: PopularRankingMode }> {
  try {
    const rows = await db.$queryRaw<Array<{ id: number }>>(popularListingIdsQuery(true));
    return { ids: rows.map(row => Number(row.id)), ranking: 'appreciations_and_views' };
  } catch (error) {
    if (missingViewStorage(error)) {
      try {
        const rows = await db.$queryRaw<Array<{ id: number }>>(popularListingIdsQuery(false));
        return { ids: rows.map(row => Number(row.id)), ranking: 'appreciations_only' };
      } catch (fallbackError) {
        if (!missingAppreciationTable(fallbackError)) throw fallbackError;
        return { ids: [], ranking: 'unavailable' };
      }
    }
    if (missingAppreciationTable(error)) return { ids: [], ranking: 'unavailable' };
    throw error;
  }
}
