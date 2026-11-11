import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { requireAuth, requireReviewer, canReview, reviewCampusIds } from '../auth.js';
import { audit, notify } from '../audit.js';

const r = Router();
r.use(requireAuth, requireReviewer);
const scope = (u: Express.Request['user']) => { const c = reviewCampusIds(u!); return c === 'all' ? {} : { campusId: { in: c } }; };

r.get('/review-queue', async (req, res) => {
  const [listings, affiliations] = await Promise.all([
    prisma.listing.findMany({ where: { status: 'pending_review', ...scope(req.user) }, include: { category: true, seller: true, media: true, campus: true }, orderBy: { updatedAt: 'asc' } }),
    prisma.affiliation.findMany({ where: { verificationStatus: 'pending', ...scope(req.user) }, include: { user: { select: { id: true, displayName: true, email: true } }, campus: true }, orderBy: { id: 'asc' } }),
  ]);
  res.json({ listings: listings.map(l => ({ id: l.id, title: l.title, description: l.description, price: Number(l.price), type: l.type, flags: l.flags ?? [],
    category: l.category.name, store: l.seller.storeName, campus: l.campus.code, images: l.media.map(m => `/api/v1/media/${m.id}`) })),
    affiliations: affiliations.map(a => ({ id: a.id, user: a.user, campus: a.campus.code })) });
});

r.post('/listings/:id/decision', async (req, res) => {
  const b = z.object({ decision: z.enum(['approved', 'changes_requested', 'rejected']), reason: z.string().trim().min(5).max(1000) }).parse(req.body);
  const l = await prisma.listing.findUnique({ where: { id: Number(req.params.id) }, include: { seller: true } });
  if (!l || !canReview(req.user!, l.campusId)) throw new HttpError(404, 'not_found'); // out-of-scope looks like not found
  if (l.status !== 'pending_review') throw new HttpError(409, 'not_pending');
  const flags = (l.flags as string[] | null) ?? [];
  if (b.decision === 'approved' && flags.includes('academic_integrity_concern') && b.reason.length < 20)
    throw new HttpError(422, 'reason_too_short', 'Flagged listings need a documented reason of at least 20 characters.');
  const policy = await prisma.campusPolicy.findFirst({ where: { campusId: l.campusId }, orderBy: { version: 'desc' } });
  const status = { approved: 'published', changes_requested: 'changes_requested', rejected: 'rejected' }[b.decision] as any;
  await prisma.$transaction([
    prisma.listing.update({ where: { id: l.id }, data: { status } }),
    prisma.listingReview.create({ data: { listingId: l.id, reviewerId: req.user!.id, decision: b.decision, reason: b.reason, policyVersionId: policy?.id } }),
  ]);
  await audit(req.user!.id, `listing.${b.decision}`, 'listing', l.id, { policyVersionId: policy?.id });
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
  await prisma.listing.update({ where: { id: l.id }, data: { status: 'suspended' } });
  await audit(req.user!.id, 'listing.suspend', 'listing', l.id, { reason: b.reason });
  await notify(l.seller.ownerUserId, 'listing.suspended', { listingId: l.id, reason: b.reason });
  res.json({ id: l.id, status: 'suspended' });
});

r.get('/reports', async (_q, res) => res.json(await prisma.report.findMany({ where: { status: { in: ['open', 'reviewing'] } }, orderBy: { createdAt: 'asc' }, take: 100 })));
r.post('/reports/:id/resolve', async (req, res) => {
  const b = z.object({ status: z.enum(['resolved', 'dismissed']) }).parse(req.body);
  await prisma.report.update({ where: { id: Number(req.params.id) }, data: { status: b.status, assignedReviewerId: req.user!.id } });
  await audit(req.user!.id, `report.${b.status}`, 'report', Number(req.params.id));
  res.status(204).end();
});

const MIN_COUNT = 5; // small counts are suppressed so one student cannot be singled out
r.get('/analytics/overview', async (req, res) => {
  const campuses = await prisma.campus.findMany({ where: { active: true, ...(reviewCampusIds(req.user!) === 'all' ? {} : { id: { in: reviewCampusIds(req.user!) as number[] } }) } });
  const out = [];
  for (const c of campuses) {
    const [stores, published, flagged, inquiries, services] = await Promise.all([
      prisma.sellerProfile.count({ where: { campusId: c.id, approvalStatus: 'approved' } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'published' } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'pending_review' } }),
      prisma.inquiryThread.count({ where: { listing: { campusId: c.id } } }),
      prisma.listing.count({ where: { campusId: c.id, status: 'published', type: 'service' } }),
    ]);
    const s = (n: number) => (n > 0 && n < MIN_COUNT ? `<${MIN_COUNT}` : n);
    out.push({ campus: c.code, activeStorefronts: s(stores), publishedListings: s(published), serviceListings: s(services), pendingReview: flagged, inquiries: s(inquiries) });
  }
  res.json({ note: 'Counts below 5 are suppressed. Inquiries are not completed sales.', campuses: out });
});
export default r;
