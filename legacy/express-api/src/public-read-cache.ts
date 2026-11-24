import { prisma } from './db.js';
import { DEFAULT_GUIDELINES } from './managed-content.js';

export function createReadCache<T>(load: () => PromiseLike<T>, ttlMs: number, now = () => performance.now()) {
  type Entry = { result: Promise<T>; expiresAt: number };
  let current: Entry | undefined;

  return {
    read(): Promise<T> {
      if (current && now() < current.expiresAt) return current.result;

      const entry: Entry = {
        expiresAt: Infinity,
        result: Promise.resolve().then(load).then(value => {
          entry.expiresAt = now() + ttlMs;
          return value;
        }, error => {
          if (current === entry) current = undefined;
          throw error;
        }),
      };
      current = entry;
      return entry.result;
    },
    invalidate() {
      current = undefined;
    },
  };
}

// One entry per unfiltered public resource, shared only inside this API process.
const ttlMs = 30_000;

export const publicCampusesCache = createReadCache(() => prisma.campus.findMany({
  where: { active: true }, select: { id: true, code: true, name: true },
}), ttlMs);

export const publicCategoriesCache = createReadCache(() => prisma.category.findMany({
  select: { id: true, parentId: true, name: true, listingType: true },
}), ttlMs);

export const publicGuidelinesCache = createReadCache(async () => {
  const content = await prisma.guidelineContent.findUnique({
    where: { id: 1 }, select: { publishedBody: true, publishedAt: true },
  });
  return { body: content?.publishedBody ?? DEFAULT_GUIDELINES, publishedAt: content?.publishedAt ?? null };
}, ttlMs);

export const publicAnnouncementsCache = createReadCache(async () => {
  const items = await prisma.announcement.findMany({
    where: { status: 'published' }, orderBy: { publishedAt: 'desc' }, take: 10,
    select: { id: true, title: true, body: true, publishedAt: true },
  });
  return { items };
}, ttlMs);
