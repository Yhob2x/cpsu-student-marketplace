import { z } from 'zod';
import { plainContent } from './managed-content.js';
import defaultHomePage from '../../shared/home-page-defaults.json' with { type: 'json' };

export const imageSlotSchema = z.enum(['hero', 'steps', 'cta']);
export type HomeImageSlot = z.infer<typeof imageSlotSchema>;

const line = (max: number) => plainContent(max).refine(value => !/[\r\n]/.test(value), 'Use a single line');
export const homeCopySchema = z.object({
  heroEyebrow: line(70),
  heroLine1: line(70),
  heroAccent: line(12),
  heroLine2: line(70),
  heroLine3: line(70),
  heroBody: plainContent(240),
  searchHeading: line(100),
  categoryHeading: line(70),
  trustHeading: line(100),
  trustAccent: line(70),
  trustItems: z.tuple([line(100), line(100), line(100), line(100)]),
  stepsEyebrow: line(70),
  stepsHeading: line(80),
  stepsAccent: line(70),
  steps: z.tuple([
    z.object({ title: line(70), body: plainContent(160) }).strict(),
    z.object({ title: line(70), body: plainContent(160) }).strict(),
    z.object({ title: line(70), body: plainContent(160) }).strict(),
  ]),
  ctaHeading: line(100),
  ctaBody: plainContent(180),
}).strict();

export const homePageSchema = z.object({
  copy: homeCopySchema,
  images: z.object({
    hero: z.string().min(1).max(512).nullable(),
    steps: z.string().min(1).max(512).nullable(),
    cta: z.string().min(1).max(512).nullable(),
  }).strict(),
}).strict();
export type HomePageSnapshot = z.infer<typeof homePageSchema>;
export type HomeCopy = z.infer<typeof homeCopySchema>;

export const DEFAULT_HOME_PAGE: HomePageSnapshot = homePageSchema.parse(defaultHomePage);

export function publicHomePage(snapshot: HomePageSnapshot, revision: number,
  imageBase = '/api/v1/home-page/images') {
  return {
    copy: snapshot.copy,
    images: {
      hero: snapshot.images.hero ? `${imageBase}/hero?v=${revision}` : null,
      steps: snapshot.images.steps ? `${imageBase}/steps?v=${revision}` : null,
      cta: snapshot.images.cta ? `${imageBase}/cta?v=${revision}` : null,
    },
  };
}
