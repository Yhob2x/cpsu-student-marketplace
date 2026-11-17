import { describe, expect, test } from 'bun:test';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { readFileSync } from 'node:fs';
import { reportRequestSchema, resolvePublicReportTarget, createAuditedPublicReport } from '../src/report-safety';
import { HttpError } from '../src/http';

const reason = 'This listing appears misleading';
type Lookup = Pick<PrismaClient, 'listing' | 'sellerProfile'>;
const lookup = (listing: unknown, seller: unknown) => {
  const calls: Array<{type: string; query: unknown}> = [];
  const db = {
    listing: { findFirst: async (query: unknown) => { calls.push({ type: 'listing', query }); return listing; } },
    sellerProfile: { findFirst: async (query: unknown) => { calls.push({ type: 'seller', query }); return seller; } },
  } as unknown as Lookup;
  return { db, calls };
};

describe('public marketplace report target validation', () => {
  test('the guarded Stage 1 integration runner includes real MySQL report acceptance', () => {
    const runner = readFileSync(new URL('./run-integration.ts', import.meta.url), 'utf8');
    expect(runner).toContain("'test/integration/report.test.ts'");
  });

  test('isolated integration runner is forced local-only and cannot use Drive credentials', () => {
    const runner = readFileSync(new URL('./run-integration.ts', import.meta.url), 'utf8');
    const guard = readFileSync(new URL('./integration/fixtures.ts', import.meta.url), 'utf8');
    expect(runner).toContain("MEDIA_STORAGE: 'local'");
    expect(runner).toContain("GOOGLE_DRIVE_CLIENT_ID: ''");
    expect(runner).toContain("GOOGLE_DRIVE_CLIENT_SECRET: ''");
    expect(runner).toContain("GOOGLE_DRIVE_REFRESH_TOKEN: ''");
    expect(runner).toContain("GOOGLE_DRIVE_FOLDER_ID: ''");
    expect(guard).toContain("process.env.MEDIA_STORAGE !== 'local'");
  });

  test('actual report endpoint uses the guard and atomic audit creation', () => {
    const route = readFileSync(new URL('../src/routes/account.ts', import.meta.url), 'utf8');
    expect(route).toContain("r.post('/reports', makePublicReportHandler(prisma))");
    expect(route).toContain("r.use(['/saved', '/reports'], requireStudent)");
    const handler = readFileSync(new URL('../src/report-handler.ts', import.meta.url), 'utf8');
    expect(handler).toContain('reportRequestSchema.parse(req.body)');
    expect(handler).toContain('resolvePublicReportTarget(db, req.user!.id, b)');
    expect(handler).toContain('db.$transaction(tx => createAuditedPublicReport(tx, req.user!.id, target, b.reason))');
  });

  test('accepts exactly one supported target and trimmed reason', () => {
    expect(reportRequestSchema.parse({ listingId: 7, reason: '  '+reason+'  ' })).toEqual({ listingId: 7, reason });
    expect(reportRequestSchema.parse({ sellerProfileId: 4, reason })).toEqual({ sellerProfileId: 4, reason });
  });

  test.each([
    { reason }, { listingId: 1, sellerProfileId: 2, reason },
    { listingId: 0, reason }, { listingId: -2, reason },
    { sellerProfileId: 1.5, reason }, { sellerProfileId: '1', reason },
    { listingId: 1, reason: 'too short' },
    { listingId: 1, reason: 'x'.repeat(1001) },
    { listingId: 1, reason, reporterUserId: 44 },
    { listingId: 1, reason, messageId: 6 },
  ])('rejects malformed or ambiguous public report payload: %p', input => {
    expect(() => reportRequestSchema.parse(input)).toThrow(ZodError);
  });

  test('checks published, nondeleted listing with approved active seller; cannot report yourself', async () => {
    const {db,calls} = lookup({ id: 7, seller: { ownerUserId: 24 } }, null);
    const target = await resolvePublicReportTarget(db, 3, { listingId: 7, reason });
    expect(target).toEqual({ listingId: 7 });
    expect(calls).toEqual([{ type: 'listing', query: {
      where: { id: 7, status: 'published', deletedAt: null,
        seller: { approvalStatus: 'approved', owner: { status: 'active' } } },
      select: { id: true, seller: { select: { ownerUserId: true } } },
    } }]);
    await expect(resolvePublicReportTarget(db, 24, { listingId: 7, reason }))
      .rejects.toMatchObject({ status: 400, code: 'own_listing' });
  });

  test('unavailable listing cannot be reported through a forged ID', async () => {
    const {db} = lookup(null, null);
    await expect(resolvePublicReportTarget(db, 3, {listingId: 102, reason}))
      .rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  test('checks approved active seller; rejects own store or unapproved target', async () => {
    const {db,calls} = lookup(null, {id: 4, ownerUserId: 24});
    await expect(resolvePublicReportTarget(db, 24, {sellerProfileId: 4, reason}))
      .rejects.toMatchObject({ status: 400, code: 'own_store' });
    expect(await resolvePublicReportTarget(db, 3, {sellerProfileId: 4, reason})).toEqual({sellerProfileId: 4});
    expect(calls[0]).toEqual({ type: 'seller', query: {
      where: { id: 4, approvalStatus: 'approved', owner: { status: 'active' } },
      select: { id: true, ownerUserId: true },
    } });
    const missing = lookup(null, null).db;
    await expect(resolvePublicReportTarget(missing, 3, {sellerProfileId: 4, reason}))
      .rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  test('creates the report and audit together within the same transaction callback', async () => {
    const writes: Array<{kind:string;data:unknown}> = [];
    const tx = {
      report: {create: async ({data}:any) => { writes.push({kind:'report',data}); return {id:17}; }},
      auditLog: {create: async ({data}:any) => {writes.push({kind:'audit',data}); return {id:8};}},
    } as unknown as Prisma.TransactionClient;
    const result = await createAuditedPublicReport(tx, 3, {listingId: 7}, reason);
    expect(result).toEqual({id:17});
    expect(writes).toEqual([
      {kind:'report',data:{reporterUserId:3,listingId:7,reason}},
      {kind:'audit',data:{actorUserId:3,action:'report.create',targetType:'report',targetId:17}},
    ]);
  });
});
