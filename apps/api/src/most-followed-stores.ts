import type { PrismaClient } from '@prisma/client';
import { sellerAvatarUrl } from './seller-avatar-url.js';

// Ranking only uses genuine follow rows. No follower identities are returned.
const availableListing = {
  status: 'published' as const,
  availabilityState: 'available' as const,
  deletedAt: null,
};

export async function readMostFollowedStores(db: PrismaClient, avatarColumnExists: boolean) {
  // Older generated clients and databases must not invent an empty or zero-follower ranking.
  if (!db.storeFollow) return { available: false, items: [] };
  try {
    const stores = await db.sellerProfile.findMany({
      where: {
        approvalStatus: 'approved',
        owner: { status: 'active' },
        listings: { some: availableListing },
        storeFollows: { some: {} },
      },
      orderBy: [{ storeFollows: { _count: 'desc' } }, { id: 'asc' }],
      take: 4,
      select: {
        id: true, storeName: true,
        ...(avatarColumnExists ? { avatarPath: true as const } : {}),
        campus: { select: { name: true, code: true } },
        _count: { select: { storeFollows: true, listings: { where: availableListing } } },
      },
    });
    return { available: true, items: stores.map(store => ({
      id: store.id,
      storeName: store.storeName,
      campus: store.campus,
      avatarUrl: sellerAvatarUrl(store.id, 'avatarPath' in store && typeof store.avatarPath === 'string' ? store.avatarPath : null),
      followerCount: store._count.storeFollows,
      listingCount: store._count.listings,
    })) };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021') {
      return { available: false, items: [] };
    }
    throw error;
  }
}
