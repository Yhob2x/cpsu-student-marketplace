import { Router, type RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError } from '../http.js';
import { canManageCatalog } from '../permissions.js';

// Only university-wide administrators can change the shared campus and listing-category catalog.
// Campus reviewers cannot change taxonomy for the whole university.
const requireCatalogAdmin: RequestHandler = (req, _res, next) =>
  req.user && canManageCatalog(req.user) ? next() : next(new HttpError(403, 'forbidden'));

export const campusInput = z.object({
  code: z.string().trim().min(2).max(24).regex(/^[a-zA-Z0-9_-]+$/).transform(s => s.toUpperCase()),
  name: z.string().trim().min(2).max(100),
}).strict();
export const campusPatch = campusInput.partial().extend({
  active: z.boolean().optional(),
  confirmImpact: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).some(k => k !== 'confirmImpact'), 'No changes supplied');
export const serviceInput = z.object({
  name: z.string().trim().min(2).max(80),
}).strict();
export const categoryInput = serviceInput.extend({
  listingType: z.enum(['physical_product', 'service']),
}).strict();

function safeId(id: string): number {
  const number = Number(id);
  if (!Number.isSafeInteger(number) || number <= 0) throw new HttpError(400, 'invalid_id');
  return number;
}
function knownConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    throw new HttpError(409, 'catalog_duplicate');
  throw error;
}

export const catalogAdminRoutes = Router();
catalogAdminRoutes.use(requireAuth, requireCatalogAdmin);

catalogAdminRoutes.get('/', async (_req, res) => {
  const [campuses, categories] = await Promise.all([
    prisma.campus.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, active: true,
        _count: { select: { affiliations: true, listings: true, campusRoles: true } } },
    }),
    prisma.category.findMany({
      orderBy: [{ listingType: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, listingType: true, parentId: true,
        _count: { select: { listings: true, children: true } } },
    }),
  ]);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ campuses, categories });
});

catalogAdminRoutes.post('/campuses', async (req, res) => {
  const body = campusInput.parse(req.body);
  try {
    const result = await prisma.$transaction(async tx => {
      const conflict = await tx.campus.findUnique({ where: { code: body.code }, select: { id: true } });
      if (conflict) throw new HttpError(409, 'catalog_duplicate');
      const campus = await tx.campus.create({ data: body });
      await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'campus.created',
        targetType: 'campus', targetId: campus.id, metadata: { code: campus.code, name: campus.name } } });
      return campus;
    });
    res.status(201).json(result);
  } catch (error) { knownConflict(error); }
});

catalogAdminRoutes.patch('/campuses/:id', async (req, res) => {
  const id = safeId(req.params.id);
  const body = campusPatch.parse(req.body);
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.campus.findUnique({
        where: { id }, select: { code: true, name: true, active: true,
          _count: { select: { affiliations: true, listings: true, campusRoles: true } } },
      });
      if (!current) throw new HttpError(404, 'not_found');
      if (body.code && body.code !== current.code &&
          await tx.campus.findUnique({ where: { code: body.code } })) throw new HttpError(409, 'catalog_duplicate');
      if (body.active === false && current.active &&
          current._count.affiliations + current._count.listings + current._count.campusRoles > 0 &&
          !body.confirmImpact) throw new HttpError(409, 'campus_in_use');
      const campus = await tx.campus.update({ where: { id }, data: {
        ...(body.code !== undefined ? { code: body.code } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      } });
      await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'campus.updated',
        targetType: 'campus', targetId: id, metadata: { before: { code: current.code, name: current.name, active: current.active },
          after: { code: campus.code, name: campus.name, active: campus.active } } } });
      return campus;
    });
    res.json(result);
  } catch (error) { knownConflict(error); }
});

catalogAdminRoutes.post('/services', async (req, res) => {
  const body = serviceInput.parse(req.body);
  const result = await prisma.$transaction(async tx => {
    if (await tx.category.findFirst({ where: { name: body.name, listingType: 'service' } }))
      throw new HttpError(409, 'catalog_duplicate');
    const category = await tx.category.create({ data: { name: body.name, listingType: 'service' } });
    await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'service_category.created',
      targetType: 'category', targetId: category.id, metadata: { name: category.name } } });
    return category;
  });
  res.status(201).json(result);
});

catalogAdminRoutes.patch('/services/:id', async (req, res) => {
  const id = safeId(req.params.id);
  const body = serviceInput.parse(req.body);
  const result = await prisma.$transaction(async tx => {
    const current = await tx.category.findFirst({ where: { id, listingType: 'service' } });
    if (!current) throw new HttpError(404, 'not_found');
    if (body.name !== current.name &&
        await tx.category.findFirst({ where: { name: body.name, listingType: 'service', id: { not: id } } }))
      throw new HttpError(409, 'catalog_duplicate');
    const category = await tx.category.update({ where: { id }, data: { name: body.name } });
    await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'service_category.updated',
      targetType: 'category', targetId: id, metadata: { before: current.name, after: category.name } } });
    return category;
  });
  res.json(result);
});


// Both product and service categories share the existing Category table.
// The category type is fixed after creation so current listings cannot change kind.
catalogAdminRoutes.post('/categories', async (req, res) => {
  const body = categoryInput.parse(req.body);
  const category = await prisma.$transaction(async tx => {
    if (await tx.category.findFirst({ where: { name: body.name, listingType: body.listingType } }))
      throw new HttpError(409, 'catalog_duplicate');
    const created = await tx.category.create({ data: { name: body.name, listingType: body.listingType } });
    await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'category.created',
      targetType: 'category', targetId: created.id,
      metadata: { name: created.name, listingType: created.listingType } } });
    return created;
  });
  res.status(201).json(category);
});

catalogAdminRoutes.patch('/categories/:id', async (req, res) => {
  const id = safeId(req.params.id);
  const body = serviceInput.parse(req.body);
  const category = await prisma.$transaction(async tx => {
    const current = await tx.category.findUnique({ where: { id } });
    if (!current) throw new HttpError(404, 'not_found');
    if (body.name !== current.name &&
        await tx.category.findFirst({ where: { name: body.name,
          listingType: current.listingType, id: { not: id } } }))
      throw new HttpError(409, 'catalog_duplicate');
    const updated = await tx.category.update({ where: { id }, data: { name: body.name } });
    await tx.auditLog.create({ data: { actorUserId: req.user!.id, action: 'category.updated',
      targetType: 'category', targetId: id,
      metadata: { before: current.name, after: updated.name, listingType: current.listingType } } });
    return updated;
  });
  res.json(category);
});
