import { createHmac, randomBytes } from 'node:crypto';
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { env } from './env.js';
import { HttpError } from './http.js';
import { visibleStudentStoreWhere } from './store-visibility.js';

type Db = Pick<PrismaClient, 'listing' | '$queryRaw' | '$executeRaw' | '$transaction'>;
const COOKIE = 'cpsu_listing_visitor';
const DAY_MS = 24 * 60 * 60 * 1000;
const listingId = z.coerce.number().int().positive();
export type ViewSummary = { available: boolean; count: number | null };
const unavailable: ViewSummary = { available: false, count: null };

// Missing optional migration, including Prisma raw-query error P2010 / MySQL 1146.
// Never treat unrelated SQL failures as a zero-view count.
export function missingViewStorage(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'P2021' || error.code === 'P2022') return true;
  if (error.code !== 'P2010' || !('meta' in error)) return false;
  const meta = error.meta;
  return Boolean(meta && typeof meta === 'object' && 'code' in meta && String(meta.code) === '1146'
    && 'message' in meta && /ListingView(Counter|Dedup)/i.test(String(meta.message)));
}

export function viewVisitorHash(token: string, id: number, now: Date, secret: string): string {
  // Per-listing and per-UTC-day; hashes cannot be joined to reveal cross-listing browsing.
  return createHmac('sha256', secret)
    .update(`${id}:${now.toISOString().slice(0, 10)}:${token}`)
    .digest('hex');
}

export function safeViewCount(value: number | bigint): number {
  return Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Number(value)));
}

export async function readListingViewCounts(db: Pick<Db, '$queryRaw'>, ids: readonly number[]):
  Promise<Record<number, ViewSummary>> {
  if (!ids.length) return {};
  try {
    const rows = await db.$queryRaw<Array<{ listingId: number; viewCount: bigint }>>`
      SELECT listingId, viewCount FROM ListingViewCounter
      WHERE listingId IN (${Prisma.join([...new Set(ids)])})
    `;
    const counts = new Map(rows.map(row => [row.listingId, safeViewCount(row.viewCount)]));
    return Object.fromEntries(ids.map(id => [id, { available: true, count: counts.get(id) ?? 0 }]));
  } catch (error) {
    if (missingViewStorage(error)) return Object.fromEntries(ids.map(id => [id, unavailable]));
    throw error;
  }
}

export async function recordListingView(db: Db, id: number, token: string, now = new Date()):
  Promise<{ available: boolean; count: number | null; recorded: boolean }> {
  const digest = viewVisitorHash(token, id, now, env.JWT_SECRET);
  try {
    const result = await db.$transaction(async tx => {
      const inserted = await tx.$executeRaw`
        INSERT IGNORE INTO ListingViewDedup (listingId, viewerHash, createdAt)
        VALUES (${id}, ${digest}, UTC_TIMESTAMP(3))
      `;
      if (inserted === 1) {
        await tx.$executeRaw`
          INSERT INTO ListingViewCounter (listingId, viewCount) VALUES (${id}, 1)
          ON DUPLICATE KEY UPDATE viewCount = viewCount + 1
        `;
      }
      const rows = await tx.$queryRaw<Array<{ viewCount: bigint }>>`
        SELECT viewCount FROM ListingViewCounter WHERE listingId = ${id}
      `;
      return { count: rows[0] ? safeViewCount(rows[0].viewCount) : 0, recorded: inserted === 1 };
    });
    // Cleanup uses an indexed, bounded delete; raw visitor tokens are never persisted.
    await db.$executeRaw`
      DELETE FROM ListingViewDedup
      WHERE createdAt < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY)
      LIMIT 200
    `;
    return { available: true, ...result };
  } catch (error) {
    if (missingViewStorage(error)) return { ...unavailable, recorded: false };
    throw error;
  }
}

export function makeListingViewsRouter(db: Db) {
  const router = Router();

  // Visible-only batched counts on cards; no visitor identifiers returned.
  router.get('/listing-views', async (req, res) => {
    const raw = z.string().max(600).parse(req.query.ids);
    const ids = [...new Set(raw.split(',').map(value => listingId.parse(value)))];
    if (!ids.length || ids.length > 50) throw new HttpError(400, 'invalid_listing_ids');
    const rows = await db.listing.findMany({
      where: { id: { in: ids }, status: 'published', deletedAt: null,
        seller: visibleStudentStoreWhere() },
      select: { id: true },
    });
    const views = await readListingViewCounts(db, rows.map(row => row.id));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ views });
  });

  // A view is a deliberate detail-page visit, NOT a homepage card impression.
  router.post('/listings/:id/view', async (req, res) => {
    if (req.get('Sec-Fetch-Site') === 'cross-site') throw new HttpError(403, 'forbidden');
    const id = listingId.parse(req.params.id);
    const listing = await db.listing.findFirst({
      where: { id, status: 'published', availabilityState: 'available',
        deletedAt: null, seller: visibleStudentStoreWhere() },
      select: { seller: { select: { ownerUserId: true } } },
    });
    if (!listing) throw new HttpError(404, 'listing_not_available');
    // Owners and staff may inspect a listing without gaming its ranking.
    if (req.user && (req.user.id === listing.seller.ownerUserId || req.user.roles.length)) {
      const existing = (await readListingViewCounts(db, [id]))[id];
      return res.json({ ...existing, recorded: false });
    }
    const previous: unknown = req.cookies?.[COOKIE];
    const token = typeof previous === 'string' && /^[a-f0-9]{48}$/.test(previous)
      ? previous : randomBytes(24).toString('hex');
    const result = await recordListingView(db, id, token);
    if (result.available && token !== previous) {
      res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax',
        secure: env.COOKIE_SECURE === 'true', maxAge: DAY_MS, path: '/api/v1/listings' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  });

  return router;
}
