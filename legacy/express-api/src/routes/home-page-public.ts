import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { HttpError } from '../http.js';
import { DEFAULT_HOME_PAGE, homePageSchema, imageSlotSchema, publicHomePage } from '../home-page-content.js';
import { sendHomePageImage } from '../home-page-media.js';

const r = Router();
const missingTable = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';

r.get('/', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const row = await prisma.homePageContent.findUnique({
      where: { id: 1 }, select: { published: true, publishedRevision: true },
    });
    const published = row?.published ? homePageSchema.safeParse(row.published) : null;
    return res.json(publicHomePage(published?.success ? published.data : DEFAULT_HOME_PAGE,
      published?.success ? row!.publishedRevision : 0));
  } catch (error) {
    if (missingTable(error)) return res.json(publicHomePage(DEFAULT_HOME_PAGE, 0));
    throw error;
  }
});

r.get('/images/:slot', async (req, res) => {
  const slot = imageSlotSchema.parse(req.params.slot);
  let mediaPath: string | null = null;
  try {
    const row = await prisma.homePageContent.findUnique({ where: { id: 1 }, select: { published: true } });
    const published = row?.published ? homePageSchema.safeParse(row.published) : null;
    if (published?.success) mediaPath = published.data.images[slot];
  } catch (error) {
    if (!missingTable(error)) throw error;
  }
  if (!mediaPath) throw new HttpError(404, 'not_found');
  return sendHomePageImage(res, mediaPath);
});

export default r;
