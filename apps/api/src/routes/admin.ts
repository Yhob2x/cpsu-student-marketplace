import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth, requireReviewer, canReview, reviewCampusIds } from '../auth.js';
import { audit, notify } from '../audit.js';
import { requirePhotoReview } from '../photo-review.js';
import { DEFAULT_GUIDELINES, plainContent } from '../managed-content.js';

const r = Router();
r.use(requireAuth, requireReviewer);
const scope = (u: Express.Request['user']) => { const c = reviewCampusIds(u!); return c === 'all' ? {} : { campusId: { in: c } }; };
// Reports can target a listing or a seller. Both targets, if present, must
// belong to a permitted campus; reports with no target are not visible to campus staff.
const reportScope = (u: Express.Request['user']): Prisma.ReportWhereInput => {
  const ids = reviewCampusIds(u!);
  if (ids === 'all') return {};
  return { AND: [
    { OR: [{ listingId: { not: null } }, { sellerProfileId: { not: null } }] },
    { OR: [{ listingId: null }, { listing: { campusId: { in: ids } } }] },
    { OR: [{ sellerProfileId: null }, { seller: { campusId: { in: ids } } }] },
  ] };
};

r.get('/review-queue', async (req, res) => {
  const [listings, affiliations] = await Promise.all([
    prisma.listing.findMany({ where: { status: 'pending_review', deletedAt: null, ...scope(req.user) }, include: { category: true, seller: true, media: true, campus: true }, orderBy: { updatedAt: 'asc' } }),
    prisma.affiliation.findMany({ where: { verificationStatus: 'pending', ...scope(req.user) }, include: { user: { select: { id: true, displayName: true, email: true } }, campus: true }, orderBy: { id: 'asc' } }),
  ]);
  res.json({ listings: listings.map(l => ({ id: l.id, title: l.title, description: l.description, price: Number(l.price), type: l.type, flags: l.flags ?? [],
    category: l.category.name, store: l.seller.storeName, campus: l.campus.code, images: l.media.map(m => `/api/v1/media/${m.id}`) })),
    affiliations: affiliations.map(a => ({ id: a.id, user: a.user, campus: a.campus.code })) });
});

r.post('/listings/:id/decision', async (req, res) => {
  const b = z.object({
    decision: z.enum(['approved', 'changes_requested', 'rejected']),
    reason: z.string().trim().min(5).max(1000),
    photosReviewed: z.boolean().optional(),
  }).parse(req.body);
  const l = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: { seller: true, media: true } });
  if (!l || !canReview(req.user!, l.campusId)) throw new HttpError(404, 'not_found'); // out-of-scope looks like not found
  if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
  if (l.status !== 'pending_review') throw new HttpError(409, 'not_pending');
  // Require explicit human inspection of all photos before publication.
  requirePhotoReview(b.decision, b.photosReviewed, l.media.length);
  const flags = (l.flags as string[] | null) ?? [];
  if (b.decision === 'approved' && flags.includes('academic_integrity_concern') && b.reason.length < 20)
    throw new HttpError(422, 'reason_too_short', 'Flagged listings need a documented reason of at least 20 characters.');
  const policy = await prisma.campusPolicy.findFirst({ where: { campusId: l.campusId }, orderBy: { version: 'desc' } });
  const status = { approved: 'published', changes_requested: 'changes_requested', rejected: 'rejected' }[b.decision] as any;
  await prisma.$transaction([
    prisma.listing.update({ where: { id: l.id }, data: { status } }),
    prisma.listingReview.create({ data: { listingId: l.id, reviewerId: req.user!.id, decision: b.decision, reason: b.reason, policyVersionId: policy?.id } }),
  ]);
  await audit(req.user!.id, `listing.${b.decision}`, 'listing', l.id, {
    policyVersionId: policy?.id,
    ...(b.decision === 'approved' ? { photosReviewed: true, photoCount: l.media.length } : {}),
  });
  await notify(l.seller.ownerUserId, 'listing.decision', { listingId: l.id, title: l.title, decision: b.decision, reason: b.reason });
  res.json({ id: l.id, status });
});

// Verifies a pending campus affiliation (the doc's /admin/sellers/:id/verify, keyed on the affiliation).
r.post('/affiliations/:id/verify', async (req, res) => {
  const b = z.object({ decision: z.enum(['verified', 'rejected']), reason: z.string().trim().min(3).max(500) }).parse(req.body);
  const a = await prisma.affiliation.findUnique({ where: { id: Number(req.params.id) } });
  if (!a || !canReview(req.user!, a.campusId)) throw new HttpError(404, 'not_found');
  await prisma.affiliation.update({ where: { id: a.id }, data: { verificationStatus: b.decision, verifiedAt: b.decision === 'verified' ? new Date() : null } });
  await audit(req.user!.id, `affiliation.${b.decision}`, 'affiliation', a.id, { reason: b.reason });
  await notify(a.userId, 'affiliation.decision', { decision: b.decision, reason: b.reason });
  res.json({ id: a.id, status: b.decision });
});

r.post('/listings/:id/suspend', async (req, res) => {
  const b = z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body);
  const l = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: { seller: true } });
  if (!l || !canReview(req.user!, l.campusId)) throw new HttpError(404, 'not_found');
  if (l.deletedAt) throw new HttpError(409, 'listing_deleted');
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'suspended' } });
  await audit(req.user!.id, 'listing.suspend', 'listing', l.id, { reason: b.reason });
  await notify(l.seller.ownerUserId, 'listing.suspended', { listingId: l.id, reason: b.reason });
  res.json({ id: l.id, status: 'suspended' });
});

// Campus reviewers can monitor transaction status, but not read participants' chat,
// payment arrangements or private IDs. Monitoring never mutates a transaction.
r.get('/transactions', async (req, res) => {
  const { page, pageSize } = z.object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(30).default(20),
  }).strict().parse(req.query);
  const campuses = reviewCampusIds(req.user!);
  const where: Prisma.TransactionWhereInput = campuses === 'all'
    ? {} : { listing: { campusId: { in: campuses } } };
  const [items, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, status: true, createdAt: true, updatedAt: true,
        listing: { select: { id: true, title: true, type: true,
          campus: { select: { code: true } } } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items, total, page, pageSize });
});

r.get('/reports', async (req, res) => res.json(await prisma.report.findMany({
  where: { status: { in: ['open', 'reviewing'] }, ...reportScope(req.user) },
  orderBy: { createdAt: 'asc' }, take: 100,
})));
r.post('/reports/:id/resolve', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const b = z.object({ status: z.enum(['resolved', 'dismissed']), reason: z.string().trim().min(10).max(1000) }).parse(req.body);
  const where = { id, ...reportScope(req.user) };
  const report = await prisma.report.findFirst({ where, select: { status: true } });
  if (!report) throw new HttpError(404, 'not_found');
  if (!['open', 'reviewing'].includes(report.status)) throw new HttpError(409, 'already_resolved');
  // Resolve and record the finding atomically: a failed audit must not close the report.
  await prisma.$transaction(async tx => {
    const result = await tx.report.updateMany({
      where: { ...where, status: { in: ['open', 'reviewing'] } },
      data: { status: b.status, assignedReviewerId: req.user!.id },
    });
    if (result.count !== 1) throw new HttpError(409, 'already_resolved');
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: `report.${b.status}`,
      targetType: 'report', targetId: id, metadata: { reason: b.reason },
    } });
  });
  res.status(204).end();
});

// Account-wide suspension is more powerful than campus moderation. Only a
// global university administrator may exercise it; campus reviewers cannot.
const accountAdmin = (req: Express.Request) =>
  req.user!.roles.some(role => role.role === 'university_admin' && role.campusId === null);

r.get('/content/guidelines', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const content = await prisma.guidelineContent.findUnique({ where: { id: 1 } });
  res.json(content ?? { id: 1, draftBody: DEFAULT_GUIDELINES, publishedBody: null, publishedAt: null });
});
r.put('/content/guidelines', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const { body } = z.object({ body: plainContent(10000) }).parse(req.body);
  const content = await prisma.guidelineContent.upsert({ where: { id: 1 }, create: { id: 1, draftBody: body }, update: { draftBody: body } });
  await audit(req.user!.id, 'guidelines.draft_saved', 'guidelines', 1);
  res.json(content);
});
r.post('/content/guidelines/publish', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const { expectedBody } = z.object({ expectedBody: plainContent(10000) }).parse(req.body);
  const current = await prisma.guidelineContent.findUnique({ where: { id: 1 } });
  if (!current) throw new HttpError(409, 'no_draft');
  if (current.draftBody !== expectedBody) throw new HttpError(409, 'draft_changed');
  const changed = await prisma.guidelineContent.updateMany({ where: { id: 1, draftBody: expectedBody }, data: { publishedBody: expectedBody, publishedAt: new Date() } });
  if (changed.count !== 1) throw new HttpError(409, 'draft_changed');
  const content = await prisma.guidelineContent.findUniqueOrThrow({ where: { id: 1 } });
  await audit(req.user!.id, 'guidelines.published', 'guidelines', 1);
  res.json(content);
});

r.get('/content/announcements', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const items = await prisma.announcement.findMany({ orderBy: { id: 'desc' }, take: 50 });
  res.json({ items });
});
const announcementInput = z.object({ title: plainContent(120), body: plainContent(2000) });
r.post('/content/announcements', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const data = announcementInput.parse(req.body);
  const item = await prisma.announcement.create({ data });
  await audit(req.user!.id, 'announcement.created', 'announcement', item.id);
  res.status(201).json(item);
});
r.patch('/content/announcements/:id', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const data = announcementInput.parse(req.body);
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'not_found');
  if (current.status === 'archived') throw new HttpError(409, 'archived');
  const item = await prisma.announcement.update({ where: { id }, data: current.status === 'published' ? { pendingTitle: data.title, pendingBody: data.body } : data });
  await audit(req.user!.id, 'announcement.draft_saved', 'announcement', id);
  res.json(item);
});
r.post('/content/announcements/:id/publish', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { expectedTitle, expectedBody } = z.object({ expectedTitle: plainContent(120), expectedBody: plainContent(2000) }).parse(req.body);
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'not_found');
  if (current.status === 'archived') throw new HttpError(409, 'archived');
  if ((current.pendingTitle ?? current.title) !== expectedTitle || (current.pendingBody ?? current.body) !== expectedBody) throw new HttpError(409, 'draft_changed');
  const changed = await prisma.announcement.updateMany({ where: {
    id, status: current.status,
    ...(current.status === 'published' ? { pendingTitle: current.pendingTitle, pendingBody: current.pendingBody } : { title: current.title, body: current.body }),
  }, data: {
    title: expectedTitle, body: expectedBody,
    pendingTitle: null, pendingBody: null, status: 'published', publishedAt: new Date(),
  } });
  if (changed.count !== 1) throw new HttpError(409, 'draft_changed');
  const item = await prisma.announcement.findUniqueOrThrow({ where: { id } });
  await audit(req.user!.id, 'announcement.published', 'announcement', id);
  res.json(item);
});
r.post('/content/announcements/:id/archive', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) throw new HttpError(404, 'not_found');
  if (current.status === 'archived') throw new HttpError(409, 'archived');
  const item = await prisma.announcement.update({ where: { id }, data: { status: 'archived' } });
  await audit(req.user!.id, 'announcement.archived', 'announcement', id);
  res.json(item);
});

r.get('/audit-logs', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const { limit, cursor } = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.coerce.number().int().positive().optional(),
  }).parse(req.query);
  const items = await prisma.auditLog.findMany({
    where: cursor ? { id: { lt: cursor } } : {},
    select: {
      id: true, actorUserId: true, action: true, targetType: true,
      targetId: true, metadata: true, createdAt: true,
      actor: { select: { displayName: true } },
    },
    orderBy: { id: 'desc' }, take: limit,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items, nextCursor: items.length === limit ? items.at(-1)!.id : null });
});

r.get('/users', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const { q, status, verification, campusId, page, pageSize } = z.object({
    q: z.string().trim().max(80).optional(),
    status: z.enum(['active', 'suspended']).optional(),
    verification: z.enum(['unverified', 'pending', 'verified', 'rejected', 'suspended']).optional(),
    campusId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  }).parse(req.query);
  const where: Prisma.UserWhereInput = {
    roles: { none: { role: { in: ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'] } } },
    ...(q ? { OR: [{ displayName: { contains: q } }, { email: { contains: q } }] } : {}),
    ...(status ? { status } : {}),
    ...(campusId || verification ? { affiliations: { some: {
      ...(campusId ? { campusId } : {}),
      ...(verification ? { verificationStatus: verification } : {}),
    } } } : {}),
  };
  const total = await prisma.user.count({ where });
  const items = await prisma.user.findMany({
    where,
    select: {
      id: true, displayName: true, email: true, status: true,
      roles: { select: { role: true } },
      affiliations: { select: { campus: { select: { code: true } }, verificationStatus: true } },
    },
    orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items, total, page, pageSize });
});

r.patch('/users/:id/status', async (req, res) => {
  if (!accountAdmin(req)) throw new HttpError(403, 'forbidden');
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { status, reason } = z.object({
    status: z.enum(['active', 'suspended']), reason: z.string().trim().min(10).max(500),
  }).parse(req.body);
  const target = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
  if (!target) throw new HttpError(404, 'not_found');
  if (target.id === req.user!.id) throw new HttpError(409, 'self_status_change_forbidden');
  if (target.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role))) {
    throw new HttpError(403, 'staff_account_protected');
  }
  if (target.status === status) throw new HttpError(409, 'unchanged_status');
  await prisma.$transaction(async tx => {
    const updated = await tx.user.updateMany({ where: { id, status: target.status }, data: { status } });
    if (updated.count !== 1) throw new HttpError(409, 'status_changed');
    if (status === 'suspended') {
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: status === 'suspended' ? 'user.suspended' : 'user.reactivated',
      targetType: 'user', targetId: id, metadata: { reason },
    } });
    await tx.notification.create({ data: {
      userId: id, type: 'account.status', payload: { status },
    } });
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ id, status });
});

const MIN_COUNT = 5; // small counts are suppressed so one student cannot be singled out
r.get('/analytics/overview', async (req, res) => {
  const campuses = await prisma.campus.findMany({ where: { active: true, ...(reviewCampusIds(req.user!) === 'all' ? {} : { id: { in: reviewCampusIds(req.user!) as number[] } }) } });
  const out = [];
  for (const c of campuses) {
    const [stores, published, flagged, inquiries, services] = await Promise.all([
      prisma.sellerProfile.count({ where: { campusId: c.id, approvalStatus: 'approved' } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'published', deletedAt: null, availabilityState: 'available' } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'pending_review', deletedAt: null } }),
      prisma.inquiryThread.count({ where: { listing: { campusId: c.id } } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'published', type: 'service', deletedAt: null, availabilityState: 'available' } }),
    ]);
    const s = (n: number) => (n > 0 && n < MIN_COUNT ? `<${MIN_COUNT}` : n);
    out.push({ campus: c.code, activeStorefronts: s(stores), publishedListings: s(published), serviceListings: s(services), pendingReview: flagged, inquiries: s(inquiries) });
  }
  res.json({ note: 'Counts below 5 are suppressed. Inquiries are not completed sales.', campuses: out });
});
export default r;
