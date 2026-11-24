import { describe, expect, test } from 'bun:test';
import { DEFAULT_HOME_PAGE, resolveHomePageContent, homePageDraftStatus } from '../src/home-page-content';

describe('public homepage content', () => {
  test('uses shipped copy when a managed version is unavailable', () => {
    expect(resolveHomePageContent(null)).toEqual(DEFAULT_HOME_PAGE);
    expect(resolveHomePageContent({ copy: {} } as never)).toEqual(DEFAULT_HOME_PAGE);
  });

  test('uses published text and image URL', () => {
    const edited = {
      copy: { ...DEFAULT_HOME_PAGE.copy, trustHeading: 'Campus trading, made clear' },
      images: { ...DEFAULT_HOME_PAGE.images, steps: '/api/v1/home-page/images/steps?v=3' },
    };
    expect(resolveHomePageContent(edited).copy.trustHeading).toBe('Campus trading, made clear');
    expect(resolveHomePageContent(edited).images.steps).toBe(edited.images.steps);
  });
});

describe('homepage draft publication state', () => {
  test('separates an unpublished revision from the live default page', () => {
    expect(homePageDraftStatus({ revision: 3, publishedRevision: 2, publishedAt: null })).toEqual({
      pending: true,
      label: 'Unpublished draft changes',
      detail: 'Students still see the default homepage until you publish this draft.',
    });
  });
  test('identifies the published page and later unpublished changes', () => {
    expect(homePageDraftStatus({ revision: 7, publishedRevision: 7, publishedAt: '2026-11-18T01:00:00Z' }).pending).toBe(false);
    expect(homePageDraftStatus({ revision: 8, publishedRevision: 7, publishedAt: '2026-11-18T01:00:00Z' })).toEqual({
      pending: true,
      label: 'Unpublished draft changes',
      detail: 'Students still see the previously published homepage until you publish this draft.',
    });
  });
});
