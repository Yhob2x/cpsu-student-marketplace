import shipped from '../../../shared/home-page-defaults.json';

export type HomeImageSlot = 'hero' | 'steps' | 'cta';
export type HomePageCopy = typeof shipped.copy;
export type HomePageView = {
  copy: HomePageCopy;
  images: Record<HomeImageSlot, string | null>;
};
export type HomePageEditorState = {
  draft: HomePageView;
  published: HomePageView | null;
  revision: number;
  publishedRevision: number;
  publishedAt: string | null;
};

export const DEFAULT_HOME_PAGE: HomePageView = {
  copy: shipped.copy,
  images: { hero: null, steps: null, cta: null },
};

export function resolveHomePageContent(value: unknown): HomePageView {
  if (!value || typeof value !== 'object') return DEFAULT_HOME_PAGE;
  const content = value as Partial<HomePageView>;
  if (!content.copy || typeof content.copy.heroLine1 !== 'string' ||
      typeof content.copy.trustHeading !== 'string' ||
      !Array.isArray(content.copy.trustItems) || content.copy.trustItems.length !== 4 ||
      !Array.isArray(content.copy.steps) || content.copy.steps.length !== 3 ||
      !content.images || typeof content.images !== 'object')
    return DEFAULT_HOME_PAGE;
  return content as HomePageView;
}

export function homePageDraftStatus(state: Pick<HomePageEditorState, 'revision' | 'publishedRevision' | 'publishedAt'>): {
  pending: boolean;
  label: string;
  detail: string;
} {
  if (state.revision > state.publishedRevision) {
    return {
      pending: true,
      label: 'Unpublished draft changes',
      detail: state.publishedAt
        ? 'Students still see the previously published homepage until you publish this draft.'
        : 'Students still see the default homepage until you publish this draft.',
    };
  }
  return state.publishedAt
    ? { pending: false, label: 'Homepage is live', detail: 'Students can see the latest published homepage.' }
    : { pending: false, label: 'Default homepage is live', detail: 'There are no unpublished draft changes.' };
}

/**
 * Splits the managed hero copy into the concept layout: "Buy, Sell & Connect" / "on Campus",
 * with the second line-1 word highlighted. A trailing comma before an "&" accent is dropped
 * so "Buy, Sell," + "&" reads "Buy, Sell &".
 */
export function heroHeadline(copy: Pick<HomePageCopy, 'heroLine1' | 'heroAccent' | 'heroLine2' | 'heroLine3'>): { lead: string; highlight: string; tail: string } {
  const line1 = copy.heroLine1.trim();
  const accent = copy.heroAccent.trim();
  const lead = accent === '&' ? `${line1.replace(/,$/, '')} &` : [line1, accent].filter(Boolean).join(' ');
  return { lead, highlight: copy.heroLine2.trim(), tail: copy.heroLine3.trim() };
}
