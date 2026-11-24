import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_HOME_PAGE,
  homeCopySchema,
  imageSlotSchema,
  publicHomePage,
} from '../src/home-page-content.js';

describe('managed homepage content contract', () => {
  test('defaults preserve the existing designed copy and no custom image', () => {
    expect(DEFAULT_HOME_PAGE.copy.heroLine1).toBe('Buy, Sell,');
    expect(DEFAULT_HOME_PAGE.copy.trustItems).toHaveLength(4);
    expect(DEFAULT_HOME_PAGE.copy.steps).toHaveLength(3);
    expect(DEFAULT_HOME_PAGE.images.hero).toBeNull();
  });

  test('public response exposes URLs rather than storage paths', () => {
    const result = publicHomePage({
      ...DEFAULT_HOME_PAGE,
      images: { hero: 'gdrive:private-id', steps: '0123456789abcdef0123456789abcdef.webp', cta: null },
    }, 4);
    expect(result.images.hero).toBe('/api/v1/home-page/images/hero?v=4');
    expect(result.images.steps).toBe('/api/v1/home-page/images/steps?v=4');
    expect(JSON.stringify(result)).not.toContain('private-id');
  });

  test('copy rejects HTML and unknown fields', () => {
    expect(() => homeCopySchema.parse({ ...DEFAULT_HOME_PAGE.copy, heroBody: '<script>bad</script>' })).toThrow();
    expect(() => homeCopySchema.parse({ ...DEFAULT_HOME_PAGE.copy, surprise: 'extra' })).toThrow();
    expect(() => imageSlotSchema.parse('footer')).toThrow();
  });
});
