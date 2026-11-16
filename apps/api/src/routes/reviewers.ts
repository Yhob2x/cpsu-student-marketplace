import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, hashPassword } from '../auth.js';
import { HttpError } from '../http.js';
import { reviewerCreateSchema, reviewerEditSchema } from '../reviewer-validation.js';

const r = Router();
r.use(requireAuth, (req, _res, next) => req.user!.roles.some(role =>
  role.role === 'university_admin' && role.campusId === null)
  ? next() : next(new HttpError(403, 'forbidden')));

const manageable = (roles: { role: string; campusId: number | null; id: number }[]) => {
  const reviewers = roles.filter(role => role.role === 'campus_reviewer');
  return reviewers.length === 1 && roles.length === 1
    ? reviewers[0] : null;
};
const duplicateEmail = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

r.get('/', async (req, res) => {
  const { q, page, pageSize } = z.object({
    q: z.string().trim().max(80).default(''),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  }).strict().parse(req.query);
  const where: Prisma.UserWhereInput = {
    roles: { some: { role: 'campus_reviewer' } },
    NOT: { roles: { some: { role: { in: ['university_admin', 'system_admin', 'establishment'] } } } },
    ...(q ? { OR: [{ displayName: { contains: q } }, { email: { contains: q } }] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, select: {
      id: true, displayName: true, email: true, status: true,
      roles: { where: { role: 'campus_reviewer' }, select: { role: true, campusId: true,
        campus: { select: { id: true, name: true, code: true } } } },
      _count: { select: { affiliations: true } },
    }, orderBy: { id: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items, total, page, pageSize });
});

r.post('/', async (req, res) => {
  const body = reviewerCreateSchema.parse(req.body);
  const campus = await prisma.campus.findFirst({ where: { id: body.campusId, active: true }, select: { id: true } });
  if (!campus) throw new HttpError(400, 'invalid_campus');
  const passwordHash = await hashPassword(body.password);
  try {
    const created = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: {
        email: body.email, displayName: body.displayName, passwordHash,
        roles: { create: { role: 'campus_reviewer', campusId: body.campusId } },
      }, select: { id: true, email: true, displayName: true, status: true } });
      await tx.auditLog.create({ data: { actorUserId: req.user!.id,
        action: 'reviewer.created', targetType: 'user', targetId: user.id,
        metadata: { campusId: body.campusId } } });
      return user;
    });
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ ...created, campusId: body.campusId });
  } catch (error) {
    if (duplicateEmail(error)) throw new HttpError(409, 'email_taken');
    throw error;
  }
});

r.patch('/:id', async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { reason, ...changes } = reviewerEditSchema.parse(req.body);
  const target = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
  if (!target) throw new HttpError(404, 'not_found');
  const reviewerRole = manageable(target.roles);
  if (!reviewerRole) throw new HttpError(404, 'not_found');
  if (changes.campusId !== undefined && !await prisma.campus.findFirst({
    where: { id: changes.campusId, active: true }, select: { id: true },
  })) throw new HttpError(400, 'invalid_campus');
  const passwordHash = changes.password ? await hashPassword(changes.password) : undefined;
  const revokeSessions = changes.password !== undefined || changes.email !== undefined ||
    changes.campusId !== undefined || changes.status !== undefined;
  try {
    await prisma.$transaction(async tx => {
      const currentRole = manageable(await tx.userRole.findMany({ where: { userId: id } }));
      if (!currentRole) throw new HttpError(404, 'not_found');
      await tx.user.update({ where: { id }, data: {
        ...(changes.email !== undefined && { email: changes.email }),
        ...(changes.displayName !== undefined && { displayName: changes.displayName }),
        ...(changes.status !== undefined && { status: changes.status }),
        ...(passwordHash !== undefined && { passwordHash }),
      } });
      if (changes.campusId !== undefined) {
        const updated = await tx.userRole.updateMany({ where: {
          id: currentRole.id, userId: id, role: 'campus_reviewer', campusId: currentRole.campusId,
        }, data: { campusId: changes.campusId } });
        if (updated.count !== 1) throw new HttpError(409, 'reviewer_scope_changed');
      }
      if (revokeSessions) await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: req.user!.id,
        action: 'reviewer.updated', targetType: 'user', targetId: id,
        metadata: { reason, fields: Object.keys(changes), ...(changes.campusId !== undefined && { campusId: changes.campusId }) },
      } });
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ id, updated: true, sessionsRevoked: revokeSessions });
  } catch (error) {
    if (duplicateEmail(error)) throw new HttpError(409, 'email_taken');
    throw error;
  }
});

export default r;
