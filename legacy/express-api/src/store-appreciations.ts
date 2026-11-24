import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { requireStudent } from './auth.js';
import { HttpError } from './http.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

type AppreciationModel = {
  count(args: any): Promise<number>;
  findUnique(args: any): Promise<{ userId: number } | null>;
  upsert(args: any): Promise<unknown>;
  deleteMany(args: any): Promise<unknown>;
};
type Db = Pick<PrismaClient, 'sellerProfile' | 'affiliation'> & {
  // The approved app can deploy before the additive migration is activated.
  storeAppreciation?: AppreciationModel;
};
const absentTable = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e &&
  ['P2021', 'P2022'].includes(String((e as { code: unknown }).code));
const identifier = z.coerce.number().int().positive();
const unavailable = { available: false, count: null, isAppreciated: false } as const;

async function summary(db: Db, sellerProfileId: number, viewerUserId?: number) {
  if (!db.storeAppreciation) return unavailable;
  try {
    const [count, own] = await Promise.all([
      db.storeAppreciation.count({ where: { sellerProfileId } }),
      viewerUserId ? db.storeAppreciation.findUnique({
        where: { userId_sellerProfileId: { userId: viewerUserId, sellerProfileId } },
        select: { userId: true },
      }) : Promise.resolve(null),
    ]);
    return { available: true, count, isAppreciated: Boolean(own) };
  } catch (error) {
    if (absentTable(error)) return unavailable;
    throw error;
  }
}

export function makeStoreAppreciationsRouter(db: Db) {
  const r = Router();
  const visibleStore = async (id: number) => {
    const store = await db.sellerProfile.findFirst({
      where: { id, ...visibleStudentStoreWhere() },
      select: { id: true, ownerUserId: true },
    });
    if (!store) throw new HttpError(404, 'store_not_available');
    return store;
  };

  // A public count is fine; never reveal which students appreciated a store.
  r.get('/seller-profiles/:id/appreciations', async (req, res) => {
    const id = identifier.parse(req.params.id);
    await visibleStore(id);
    const result = await summary(db, id, req.user?.id);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result);
  });

  // Appreciation is one click per account, NOT a review or a verified sale.
  r.put('/store-appreciations/:id', requireStudent, async (req, res) => {
    const id = identifier.parse(req.params.id);
    const userId = req.user!.id;
    const store = await visibleStore(id);
    if (store.ownerUserId === userId) throw new HttpError(403, 'cannot_appreciate_own_store');
    const affiliation = await db.affiliation.findFirst({
      where: { userId, verificationStatus: 'verified', campus: { active: true },
        OR: [{ expirationAt: null }, { expirationAt: { gt: new Date() } }] },
      select: { id: true },
    });
    if (!affiliation) throw new HttpError(403, 'verified_student_required');
    if (!db.storeAppreciation) throw new HttpError(503, 'appreciations_not_ready');
    try {
      await db.storeAppreciation.upsert({
        where: { userId_sellerProfileId: { userId, sellerProfileId: id } },
        create: { userId, sellerProfileId: id },
        update: {},
      });
      const result = await summary(db, id, userId);
      if (!result.available) throw new HttpError(503, 'appreciations_not_ready');
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(result);
    } catch (error) {
      if (absentTable(error)) throw new HttpError(503, 'appreciations_not_ready');
      throw error;
    }
  });

  // Allow a student to withdraw appreciation, including after their affiliation expires.
  r.delete('/store-appreciations/:id', requireStudent, async (req, res) => {
    const id = identifier.parse(req.params.id);
    const userId = req.user!.id;
    const store = await visibleStore(id);
    if (store.ownerUserId === userId) throw new HttpError(403, 'cannot_appreciate_own_store');
    if (!db.storeAppreciation) throw new HttpError(503, 'appreciations_not_ready');
    try {
      await db.storeAppreciation.deleteMany({ where: { userId, sellerProfileId: id } });
      const result = await summary(db, id, userId);
      if (!result.available) throw new HttpError(503, 'appreciations_not_ready');
      res.setHeader('Cache-Control', 'private, no-store');
      res.json(result);
    } catch (error) {
      if (absentTable(error)) throw new HttpError(503, 'appreciations_not_ready');
      throw error;
    }
  });
  return r;
}
