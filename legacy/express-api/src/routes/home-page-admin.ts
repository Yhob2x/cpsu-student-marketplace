import crypto from 'node:crypto';
import fs from 'node:fs';
import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, requireReviewer } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import {
  DEFAULT_HOME_PAGE, homeCopySchema, homePageSchema, imageSlotSchema,
  publicHomePage, type HomePageSnapshot,
} from '../home-page-content.js';
import { sendHomePageImage } from '../home-page-media.js';
import { deleteStoredMedia, storeSanitizedMedia } from '../media-storage.js';
import { sanitizeListingImage } from '../upload-security.js';

const r = Router();
r.use(requireAuth, requireReviewer, (req, _res, next) => {
  if (!req.user!.roles.some(role => role.role === 'university_admin' && role.campusId === null))
    return next(new HttpError(403, 'forbidden'));
  next();
});

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: env.UPLOAD_DIR,
    filename: (_req, _file, done) => done(null, crypto.randomBytes(16).toString('hex') + '.upload'),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});
const uploadLimit = rateLimit({
  windowMs: 15 * 60_000, limit: 8, keyGenerator: req => `homepage-image:${req.user!.id}`,
  standardHeaders: 'draft-7', legacyHeaders: false,
});
const imageBase = '/api/v1/admin/content/home-page/images';
const revisionSchema = z.coerce.number().int().min(0);
type Row = NonNullable<Awaited<ReturnType<typeof prisma.homePageContent.findUnique>>>;
const snapshot = (value: unknown): HomePageSnapshot => homePageSchema.parse(value);
const view = (row: Row | null) => {
  const draft = row ? snapshot(row.draft) : DEFAULT_HOME_PAGE;
  const published = row?.published ? snapshot(row.published) : null;
  return {
    draft: publicHomePage(draft, row?.revision ?? 0, imageBase),
    published: published ? publicHomePage(published, row!.publishedRevision) : null,
    revision: row?.revision ?? 0,
    publishedRevision: row?.publishedRevision ?? 0,
    publishedAt: row?.publishedAt ?? null,
  };
};

async function saveDraft(expectedRevision: number,
  change: (current: HomePageSnapshot) => HomePageSnapshot,
  actorId: number, action: string) {
  return prisma.$transaction(async tx => {
    const current = await tx.homePageContent.findUnique({ where: { id: 1 } });
    if ((current?.revision ?? 0) !== expectedRevision) throw new HttpError(409, 'draft_changed');
    const previous = current ? snapshot(current.draft) : DEFAULT_HOME_PAGE;
    const next = homePageSchema.parse(change(previous));
    let row: Row;
    if (current) {
      const changed = await tx.homePageContent.updateMany({
        where: { id: 1, revision: expectedRevision },
        data: { draft: next as Prisma.InputJsonValue, revision: { increment: 1 } },
      });
      if (changed.count !== 1) throw new HttpError(409, 'draft_changed');
      row = await tx.homePageContent.findUniqueOrThrow({ where: { id: 1 } });
    } else {
      try {
        row = await tx.homePageContent.create({
          data: { id: 1, draft: next as Prisma.InputJsonValue, revision: 1 },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new HttpError(409, 'draft_changed');
        throw error;
      }
    }
    await tx.auditLog.create({ data: {
      actorUserId: actorId, action, targetType: 'home_page_content', targetId: 1,
      metadata: { revision: row.revision },
    } });
    return { row, previous };
  });
}

r.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const row = await prisma.homePageContent.findUnique({ where: { id: 1 } });
  res.json(view(row));
});

r.put('/', async (req, res) => {
  const { copy, expectedRevision } = z.object({
    copy: homeCopySchema, expectedRevision: revisionSchema,
  }).strict().parse(req.body);
  const { row } = await saveDraft(expectedRevision, current => ({ ...current, copy }),
    req.user!.id, 'home_page.draft_saved');
  res.json(view(row));
});

r.post('/publish', async (req, res) => {
  const { expectedRevision } = z.object({ expectedRevision: revisionSchema }).strict().parse(req.body);
  const { row, previousPublished } = await prisma.$transaction(async tx => {
    const current = await tx.homePageContent.findUnique({ where: { id: 1 } });
    if (!current || current.revision !== expectedRevision) throw new HttpError(409, 'draft_changed');
    if (current.publishedRevision === expectedRevision) throw new HttpError(409, 'already_published');
    const draft = snapshot(current.draft);
    const changed = await tx.homePageContent.updateMany({
      where: { id: 1, revision: expectedRevision, publishedRevision: { not: expectedRevision } },
      data: { published: draft as Prisma.InputJsonValue, publishedRevision: expectedRevision, publishedAt: new Date() },
    });
    if (changed.count !== 1) throw new HttpError(409, 'draft_changed');
    await tx.auditLog.create({ data: {
      actorUserId: req.user!.id, action: 'home_page.published',
      targetType: 'home_page_content', targetId: 1, metadata: { revision: expectedRevision },
    } });
    return {
      row: await tx.homePageContent.findUniqueOrThrow({ where: { id: 1 } }),
      previousPublished: current.published ? snapshot(current.published) : null,
    };
  });
  const currentPaths = new Set(Object.values(snapshot(row.draft).images));
  for (const oldPath of Object.values(previousPublished?.images ?? {})) {
    if (oldPath && !currentPaths.has(oldPath))
      await deleteStoredMedia(oldPath).catch(() => console.error('Former published homepage image cleanup failed'));
  }
  res.json(view(row));
});

r.get('/images/:slot', async (req, res) => {
  const slot = imageSlotSchema.parse(req.params.slot);
  const row = await prisma.homePageContent.findUnique({ where: { id: 1 }, select: { draft: true } });
  const mediaPath = row ? snapshot(row.draft).images[slot] : null;
  if (!mediaPath) throw new HttpError(404, 'not_found');
  return sendHomePageImage(res, mediaPath);
});

r.post('/images/:slot', (req, _res, next) => {
  imageSlotSchema.parse(req.params.slot);
  next();
}, uploadLimit, (req, res, next) =>
  upload.single('image')(req, res, error => {
    if (error) return next(new HttpError(400, 'invalid_image', 'Choose a JPEG, PNG or WebP image up to 3 MB.'));
    next();
  }), async (req, res) => {
  const slot = imageSlotSchema.parse(req.params.slot);
  if (!req.file) throw new HttpError(400, 'invalid_image', 'Choose a JPEG, PNG or WebP image up to 3 MB.');
  let expectedRevision: number;
  try {
    expectedRevision = revisionSchema.parse(req.body.expectedRevision);
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    throw error;
  }
  const safe = await sanitizeListingImage(req.file, env.UPLOAD_DIR);
  const stored = await storeSanitizedMedia(safe);
  try {
    const { row, previous } = await saveDraft(expectedRevision,
      current => ({ ...current, images: { ...current.images, [slot]: stored.mediaPath } }),
      req.user!.id, 'home_page.image_saved');
    const oldPath = previous.images[slot];
    const published = row.published ? snapshot(row.published) : null;
    if (oldPath && !Object.values(snapshot(row.draft).images).includes(oldPath) &&
        !Object.values(published?.images ?? {}).includes(oldPath)) {
      await deleteStoredMedia(oldPath).catch(() => console.error('Former homepage image cleanup failed'));
    }
    res.json(view(row));
  } catch (error) {
    await deleteStoredMedia(stored.mediaPath).catch(() => console.error('Rejected homepage image cleanup failed'));
    throw error;
  }
});

r.delete('/images/:slot', async (req, res) => {
  const slot = imageSlotSchema.parse(req.params.slot);
  const { expectedRevision } = z.object({ expectedRevision: revisionSchema }).strict().parse(req.body);
  const { row, previous } = await saveDraft(expectedRevision,
    current => ({ ...current, images: { ...current.images, [slot]: null } }),
    req.user!.id, 'home_page.image_removed');
  const oldPath = previous.images[slot];
  const published = row.published ? snapshot(row.published) : null;
  if (oldPath && !Object.values(snapshot(row.draft).images).includes(oldPath) &&
      !Object.values(published?.images ?? {}).includes(oldPath))
    await deleteStoredMedia(oldPath).catch(() => console.error('Removed homepage image cleanup failed'));
  res.json(view(row));
});

r.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021')
    return next(new HttpError(503, 'home_page_editor_unavailable', 'Homepage editing needs its database migration.'));
  next(error);
});

export default r;
