import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireStudent } from '../src/auth.js';
import { errorHandler } from '../src/http.js';
import { makeListingCoverHandler } from '../src/listing-cover-handler.js';

const student = { id: 8, email: 'student@example.invalid', displayName: 'Student', roles: [] };
const reviewer = { id: 11, email: 'reviewer@example.invalid', displayName: 'Reviewer', roles: [{ role: 'campus_reviewer', campusId: 1 }] };
const initial = [{ id: 21, position: 0 }, { id: 22, position: 1 }, { id: 23, position: 2 }];

function harness(options: { account?: typeof student | typeof reviewer | null; ownerId?: number; status?: string;
  deleted?: boolean; reserved?: boolean; auditFails?: boolean } = {}) {
  let media = initial.map(row => ({ ...row }));
  const audits: unknown[] = [];
  const db = { $transaction: async (callback: any) => {
    const draft = media.map(row => ({ ...row }));
    let auditRow: unknown;
    const tx = {
      listing: { findFirst: async ({ where }: any) => where.seller.ownerUserId === (options.ownerId ?? 8)
        ? { id: 7, status: options.status ?? 'draft', deletedAt: options.deleted ? new Date() : null,
            reservationTransactionId: options.reserved ? 12 : null, media: draft } : null },
      listingMedia: { updateMany: async ({ where, data }: any) => {
        const row = draft.find(item => item.id === where.id && where.listingId === 7);
        if (!row) return { count: 0 };
        row.position = data.position; return { count: 1 };
      } },
      auditLog: { create: async ({ data }: any) => {
        if (options.auditFails) throw new Error('synthetic audit failure');
        auditRow = data;
      } },
    };
    const result = await callback(tx);
    media = draft; if (auditRow) audits.push(auditRow);
    return result;
  } } as unknown as Pick<PrismaClient, '$transaction'>;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (options.account !== null) req.user = (options.account ?? student) as any; next(); });
  app.patch('/seller/listings/:id/media/cover', requireAuth, requireStudent, makeListingCoverHandler(db));
  app.use(errorHandler);
  return { app, order: () => media.slice().sort((a, b) => a.position - b.position).map(row => row.id), audits };
}

describe('listing cover HTTP behavior (synthetic; no database access)', () => {
  test('owner can choose an attached photo; positions and audit update together', async () => {
    const h = harness();
    const response = await request(h.app).patch('/seller/listings/7/media/cover').send({ mediaId: 23 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ coverMediaId: 23 });
    expect(h.order()).toEqual([23, 21, 22]);
    expect(h.audits).toEqual([{ actorUserId: 8, action: 'listing.cover_changed', targetType: 'listing', targetId: 7,
      metadata: { coverMediaId: 23 } }]);
  });

  test('guests, staff, and another seller cannot change the cover', async () => {
    for (const options of [{ account: null }, { account: reviewer }, { ownerId: 99 }]) {
      const h = harness(options);
      const response = await request(h.app).patch('/seller/listings/7/media/cover').send({ mediaId: 23 });
      expect([401, 403, 404]).toContain(response.status);
      expect(h.order()).toEqual([21, 22, 23]);
      expect(h.audits).toEqual([]);
    }
  });

  test('foreign photos, invalid input, and locked listings cannot change the cover', async () => {
    for (const [options, payload, status] of [
      [{}, { mediaId: 999 }, 404], [{}, { mediaId: 0 }, 400], [{}, { mediaId: 23, position: 0 }, 400],
      [{ status: 'pending_review' }, { mediaId: 23 }, 409], [{ deleted: true }, { mediaId: 23 }, 409],
      [{ reserved: true }, { mediaId: 23 }, 409],
    ] as const) {
      const h = harness(options);
      expect((await request(h.app).patch('/seller/listings/7/media/cover').send(payload)).status).toBe(status);
      expect(h.order()).toEqual([21, 22, 23]);
    }
  });

  test('audit failure rolls back photo order', async () => {
    const h = harness({ auditFails: true });
    const prior = console.error; console.error = () => {};
    try { expect((await request(h.app).patch('/seller/listings/7/media/cover').send({ mediaId: 23 })).status).toBe(500); }
    finally { console.error = prior; }
    expect(h.order()).toEqual([21, 22, 23]);
    expect(h.audits).toEqual([]);
  });
});
