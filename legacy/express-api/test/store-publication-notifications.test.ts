import { describe, expect, test } from 'bun:test';
import { createFollowerPublicationNotices, FOLLOWED_STORE_NEW_LISTING } from '../src/store-publication-notifications.js';

const item = {
  id: 75, title: 'Synthetic Notebook', type: 'physical_product' as const,
  sellerProfileId: 21, storeName: 'Study Supplies', ownerUserId: 4,
};

function fixture(ids: number[] = [8, 9]) {
  const created: any[] = [];
  let serial = 100;
  let where: any;
  const db = {
    storeFollow: {
      findMany: async (input: any) => { where = input.where; return ids.map(userId => ({ userId })); },
    },
    notification: {
      create: async ({ data }: any) => {
        created.push(data);
        return { id: serial++ };
      },
    },
  };
  return { db, created, where: () => where };
}

describe('new public listing notifications for followers', () => {
  test('writes one private in-app notice per eligible follower, with a listing link payload', async () => {
    const f = fixture();
    const notices = await createFollowerPublicationNotices(f.db as any, item);
    expect(f.where()).toMatchObject({
      sellerProfileId: 21,
      userId: { not: 4 },
      user: { status: 'active', roles: { none: {
        role: { in: ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'] },
      } } },
    });
    expect(f.created).toEqual([
      { userId: 8, type: FOLLOWED_STORE_NEW_LISTING,
        payload: { storeId: 21, storeName: 'Study Supplies', listingId: 75,
          listingTitle: 'Synthetic Notebook', listingType: 'physical_product' } },
      { userId: 9, type: FOLLOWED_STORE_NEW_LISTING,
        payload: { storeId: 21, storeName: 'Study Supplies', listingId: 75,
          listingTitle: 'Synthetic Notebook', listingType: 'physical_product' } },
    ]);
    expect(notices.map(n => n.id)).toEqual([100, 101]);
  });
  test('no follower means no notice', async () => {
    const f = fixture([]);
    expect(await createFollowerPublicationNotices(f.db as any, item)).toEqual([]);
    expect(f.created).toEqual([]);
  });
  test('notification creation failure rejects approval transaction', async () => {
    const f = fixture([8]);
    f.db.notification.create = async () => { throw new Error('synthetic database failure'); };
    expect(createFollowerPublicationNotices(f.db as any, item))
      .rejects.toThrow('synthetic database failure');
  });
  test('service listing uses its actual listingType', async () => {
    const f = fixture([8]);
    const notices = await createFollowerPublicationNotices(f.db as any, {
      ...item, type: 'service', title: 'Tutoring session',
    });
    expect(notices[0].payload.listingType).toBe('service');
  });
});
