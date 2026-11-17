import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { requireAuth, requireStudent } from '../src/auth.js';
import { errorHandler } from '../src/http.js';
import { makePublicReportHandler } from '../src/report-handler.js';

const reason = 'The listing details are misleading';
const student = { id: 8, email: 'student@example.invalid', displayName: 'Student', roles: [] };
const reviewer = { id: 11, email: 'reviewer@example.invalid', displayName: 'Reviewer',
  roles: [{ role: 'campus_reviewer', campusId: 1 }] };

type Options = {
  account?: typeof student | typeof reviewer | null;
  listing?: null | { id: number; seller: { ownerUserId: number } };
  seller?: null | { id: number; ownerUserId: number };
  auditFails?: boolean;
};

function harness(options: Options = {}) {
  const reports: unknown[] = [];
  const audits: unknown[] = [];
  const db = {
    listing: { findFirst: async () => options.listing === undefined
      ? { id: 5, seller: { ownerUserId: 44 } } : options.listing },
    sellerProfile: { findFirst: async () => options.seller === undefined
      ? { id: 9, ownerUserId: 44 } : options.seller },
    $transaction: async (callback: any) => {
      let draftReport: unknown;
      let draftAudit: unknown;
      const tx = {
        report: { create: async ({ data }: any) => { draftReport = data; return { id: 78 }; } },
        auditLog: { create: async ({ data }: any) => {
          if (options.auditFails) throw new Error('synthetic audit failure');
          draftAudit = data; return { id: 90 };
        } },
      };
      const response = await callback(tx);
      reports.push(draftReport); audits.push(draftAudit);
      return response;
    },
  } as unknown as Pick<PrismaClient, 'listing' | 'sellerProfile' | '$transaction'>;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (options.account !== null) req.user = (options.account ?? student) as any;
    next();
  });
  app.post('/api/v1/reports', requireAuth, requireStudent, makePublicReportHandler(db));
  app.use(errorHandler);
  return { app, reports, audits };
}

describe('B2a public report HTTP behavior (synthetic; zero database access)', () => {
  test('accepts a valid listing report with an audit trail', async () => {
    const { app, reports, audits } = harness();
    const result = await request(app).post('/api/v1/reports').send({ listingId: 5, reason: '  ' + reason + '  ' });
    expect(result.status).toBe(201);
    expect(result.body).toEqual({ id: 78 });
    expect(reports).toEqual([{ reporterUserId: 8, listingId: 5, reason }]);
    expect(audits).toEqual([{ actorUserId: 8, action: 'report.create', targetType: 'report', targetId: 78 }]);
  });

  test('accepts an approved, active third-party seller report', async () => {
    const { app, reports } = harness();
    expect((await request(app).post('/api/v1/reports').send({ sellerProfileId: 9, reason })).status).toBe(201);
    expect(reports).toEqual([{ reporterUserId: 8, sellerProfileId: 9, reason }]);
  });

  test('denies signed-out and staff accounts before writes', async () => {
    for (const account of [null, reviewer]) {
      const { app, reports } = harness({ account });
      const response = await request(app).post('/api/v1/reports').send({ listingId: 5, reason });
      expect(response.status).toBe(account ? 403 : 401);
      expect(reports).toEqual([]);
    }
  });

  test.each([
    { listingId: 5, sellerProfileId: 9, reason },
    { listingId: 0, reason }, { listingId: 5, reason: 'short' },
    { listingId: 5, reason, reporterUserId: 99 }, { messageId: 7, reason },
  ])('rejects malformed payload without writes: %p', async payload => {
    const { app, reports } = harness();
    const result = await request(app).post('/api/v1/reports').send(payload);
    expect(result.status).toBe(400);
    expect(reports).toEqual([]);
  });

  test('reports to unavailable or self-owned content are rejected', async () => {
    const missing = harness({ listing: null });
    expect((await request(missing.app).post('/api/v1/reports').send({ listingId: 5, reason })).status).toBe(404);
    expect(missing.reports).toHaveLength(0);
    const own = harness({ listing: { id: 5, seller: { ownerUserId: 8 } } });
    expect((await request(own.app).post('/api/v1/reports').send({ listingId: 5, reason })).status).toBe(400);
    expect(own.reports).toHaveLength(0);
  });

  test('audit failure aborts the transaction instead of saving an unaudited report', async () => {
    const { app, reports, audits } = harness({ auditFails: true });
    const priorError = console.error;
    console.error = () => {}; // the expected synthetic error is handled by Express
    try {
      const result = await request(app).post('/api/v1/reports').send({ listingId: 5, reason });
      expect(result.status).toBe(500);
      expect(result.body).toEqual({ error: { code: 'internal_error' } });
      expect(reports).toHaveLength(0);
      expect(audits).toHaveLength(0);
    } finally {
      console.error = priorError;
    }
  });
});
