import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requireStudent } from './auth.js';
import { HttpError } from './http.js';

export type StoreFollowSummary = {
  count: number | null;
  isFollowing: boolean;
  available: boolean;
};
// Structural delegate keeps the app typecheckable before a schema migration/client
// regeneration; runtime access is feature-gated below until both are available.
type StoreFollowDelegate = {
  count(args: { where: { sellerProfileId: number } }): Promise<number>;
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
      where: { id, approvalStatus: 'approved', owner: { status: 'active' } },
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
