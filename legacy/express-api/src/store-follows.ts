import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requireStudent } from './auth.js';
import { HttpError } from './http.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

export type StoreFollowSummary = {
  count: number | null;
  isFollowing: boolean;
  available: boolean;
};
// Structural delegate keeps the app typecheckable before a schema migration/client
// regeneration; runtime access is feature-gated below until both are available.
type StoreFollowDelegate = {
  count(args: { where: { sellerProfileId: number } | { userId: number;
    store?: { approvalStatus: 'approved'; owner: { status: 'active' } } } }): Promise<number>;
  findMany(args: { where: { sellerProfileId: number };
    orderBy: ({ createdAt: 'desc' } | { userId: 'desc' })[];
    skip: number; take: number;
    select: { createdAt: true; user: { select: { displayName: true } } } }):
    Promise<{ createdAt: Date; user: { displayName: string } }[]>;
  findUnique(args: { where: { userId_sellerProfileId: { userId: number; sellerProfileId: number } };
    select: { userId: true } }): Promise<{ userId: number } | null>;
  upsert(args: { where: { userId_sellerProfileId: { userId: number; sellerProfileId: number } };
    create: { userId: number; sellerProfileId: number }; update: Record<string, never> }): Promise<unknown>;
  deleteMany(args: { where: { userId: number; sellerProfileId: number } }): Promise<unknown>;
};
type StoreFollowReadDb = { storeFollow?: StoreFollowDelegate };
type StoreFollowWriteDb = StoreFollowReadDb & Pick<PrismaClient, 'sellerProfile'>;

// Allow deployment of frontend/API code before the separately approved additive migration.
// An absent table is NOT a zero-follower store. Other database errors still surface.
const missingFollowTable = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021';

export async function readStoreFollowSummary(db: StoreFollowReadDb, sellerProfileId: number,
  viewerUserId?: number): Promise<StoreFollowSummary> {
  // A still-running API may use a Prisma client generated before this model existed.
  if (!db.storeFollow) return { count: null, isFollowing: false, available: false };
  try {
    const [count, follow] = await Promise.all([
      db.storeFollow.count({ where: { sellerProfileId } }),
      viewerUserId ? db.storeFollow.findUnique({
        where: { userId_sellerProfileId: { userId: viewerUserId, sellerProfileId } },
        select: { userId: true },
      }) : Promise.resolve(null),
    ]);
    return { count, isFollowing: Boolean(follow), available: true };
  } catch (error) {
    if (missingFollowTable(error)) return { count: null, isFollowing: false, available: false };
    throw error;
  }
}

export function makeStoreFollowRouter(db: StoreFollowWriteDb) {
  const r = Router();
  r.use(requireStudent);

  const storeForFollow = async (id: number) => {
    const store = await db.sellerProfile.findFirst({
      where: { id, ...visibleStudentStoreWhere() },
      select: { id: true, ownerUserId: true },
    });
    if (!store) throw new HttpError(404, 'not_found');
    return store;
  };
  const respond = async (sellerProfileId: number, userId: number) => {
    const result = await readStoreFollowSummary(db, sellerProfileId, userId);
    if (!result.available) throw new HttpError(503, 'store_follows_unavailable');
    return { count: result.count, isFollowing: result.isFollowing };
  };
  const parseId = (value: string | undefined) => z.coerce.number().int().positive().parse(value);

  // Owner-only list. Never expose follower email, student ID, legal name or affiliation.
  // The public storefront still receives a COUNT, never individual followers.
  r.get('/mine', async (req, res) => {
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
    const view = z.enum(['followers', 'following']).default('followers').parse(req.query.view);
    const countsOnly = z.enum(['true']).optional().parse(req.query.countsOnly) === 'true';
    const pageSize = 6;
    const store = await db.sellerProfile.findFirst({
      where: { ownerUserId: req.user!.id },
      select: { id: true },
    });
    if (!store) throw new HttpError(404, 'not_found');
    if (!db.storeFollow) throw new HttpError(503, 'store_follows_unavailable');
    try {
      const where = { sellerProfileId: store.id };
      const followingWhere = { userId: req.user!.id,
        store: visibleStudentStoreWhere() } as const;
      const [followerCount, followingCount] = await Promise.all([
        db.storeFollow.count({ where }),
        db.storeFollow.count({ where: followingWhere }),
      ]);
      if (countsOnly) {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ followerCount, followingCount });
        return;
      }
      if (view === 'following') {
        // Keep the pre-migration structural delegate compatible with Prisma's generic method.
        type FollowedStoreRow = { createdAt: Date; store: { id: number; storeName: string; campus: { name: string } } };
        const following = await db.storeFollow.findMany({
          where: followingWhere, orderBy: [{ createdAt: 'desc' }, { sellerProfileId: 'desc' }],
          skip: (page - 1) * pageSize, take: pageSize,
          select: { createdAt: true, store: { select: { id: true, storeName: true,
            campus: { select: { name: true } } } } },
        } as any) as unknown as FollowedStoreRow[];
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ total: followingCount, followerCount, followingCount, page, pageSize,
          items: following.map(item => ({ storeId: item.store.id, storeName: item.store.storeName,
            campusName: item.store.campus.name, followedAt: item.createdAt.toISOString() })) });
        return;
      }
      const followers = await db.storeFollow.findMany({
          where, orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
          skip: (page - 1) * pageSize, take: pageSize,
          select: { createdAt: true, user: { select: { displayName: true } } },
        });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({
        total: followerCount, followingCount, page, pageSize,
        items: followers.map(follower => ({
          displayName: follower.user.displayName,
          followedAt: follower.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      if (missingFollowTable(error)) throw new HttpError(503, 'store_follows_unavailable');
      throw error;
    }
  });

  // Idempotent follow; a composite primary key disallows duplicate membership.
  r.put('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const userId = req.user!.id;
    const store = await storeForFollow(id);
    if (store.ownerUserId === userId) throw new HttpError(400, 'own_store_follow');
    if (!db.storeFollow) throw new HttpError(503, 'store_follows_unavailable');
    try {
      await db.storeFollow.upsert({
        where: { userId_sellerProfileId: { userId, sellerProfileId: id } },
        create: { userId, sellerProfileId: id }, update: {},
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(await respond(id, userId));
    } catch (error) {
      if (missingFollowTable(error)) throw new HttpError(503, 'store_follows_unavailable');
      throw error;
    }
  });

  r.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const userId = req.user!.id;
    await storeForFollow(id);
    if (!db.storeFollow) throw new HttpError(503, 'store_follows_unavailable');
    try {
      await db.storeFollow.deleteMany({ where: { userId, sellerProfileId: id } });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(await respond(id, userId));
    } catch (error) {
      if (missingFollowTable(error)) throw new HttpError(503, 'store_follows_unavailable');
      throw error;
    }
  });
  return r;
}

// Public store connections expose only active followers' display names and
// approved stores followed by the owner. No account identifiers or contact data.
export function makePublicStoreConnectionsRouter(db: Pick<PrismaClient, 'sellerProfile'> & StoreFollowReadDb) {
  const r = Router();
  r.get('/seller-profiles/:id/connections', async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const page = z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);
    const view = z.enum(['followers', 'following']).default('followers').parse(req.query.view);
    const countsOnly = z.enum(['true']).optional().parse(req.query.countsOnly) === 'true';
    const pageSize = 6;
    const store = await db.sellerProfile.findFirst({
      where: { id, ...visibleStudentStoreWhere() },
      select: { id: true, ownerUserId: true },
    });
    if (!store) throw new HttpError(404, 'not_found');
    if (!db.storeFollow) throw new HttpError(503, 'store_follows_unavailable');
    const followerWhere = { sellerProfileId: id, user: { status: 'active' } } as const;
    const followingWhere = { userId: store.ownerUserId,
      store: visibleStudentStoreWhere() } as const;
    try {
      const [followerCount, followingCount] = await Promise.all([
        db.storeFollow.count({ where: followerWhere } as any),
        db.storeFollow.count({ where: followingWhere }),
      ]);
      if (countsOnly) {
        res.setHeader('Cache-Control', 'no-store');
        res.json({ followerCount, followingCount });
        return;
      }
      if (view === 'following') {
        type Row = { createdAt: Date; store: { id: number; storeName: string; campus: { name: string } } };
        const rows = await db.storeFollow.findMany({
          where: followingWhere, orderBy: [{ createdAt: 'desc' }, { sellerProfileId: 'desc' }],
          skip: (page - 1) * pageSize, take: pageSize,
          select: { createdAt: true, store: { select: { id: true, storeName: true,
            campus: { select: { name: true } } } } },
        } as any) as unknown as Row[];
        res.setHeader('Cache-Control', 'no-store');
        res.json({ total: followingCount, followerCount, followingCount, page, pageSize,
          items: rows.map(row => ({ storeId: row.store.id, storeName: row.store.storeName,
            campusName: row.store.campus.name, followedAt: row.createdAt.toISOString() })) });
        return;
      }
      const rows = await db.storeFollow.findMany({
        where: followerWhere, orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
        select: { createdAt: true, user: { select: { displayName: true } } },
      } as any) as Array<{ createdAt: Date; user: { displayName: string } }>;
      res.setHeader('Cache-Control', 'no-store');
      res.json({ total: followerCount, followerCount, followingCount, page, pageSize,
        items: rows.map(row => ({ displayName: row.user.displayName,
          followedAt: row.createdAt.toISOString() })) });
    } catch (error) {
      if (missingFollowTable(error)) throw new HttpError(503, 'store_follows_unavailable');
      throw error;
    }
  });
  return r;
}
