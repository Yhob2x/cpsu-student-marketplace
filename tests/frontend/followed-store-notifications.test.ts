import { describe, expect, test } from 'bun:test';
import {
  FOLLOWED_STORE_NOTICE_KIND, followedStoreNoticeTarget, followedStoreNoticeText,
} from '../../resources/js/lib/stores/followed-store-notice';

const item = (listingType: 'physical_product' | 'service', listingId: unknown = 47) => ({
  listingId, storeId: 12, storeName: 'CPSU Supplies', listingTitle: 'Notebook',
  listingType,
});

describe('followed-store notification presentation', () => {
  test('shows public store name and item title in the authenticated notification feed', () => {
    expect(followedStoreNoticeText(item('physical_product'))).toBe(
      'CPSU Supplies published a new product: Notebook.');
    expect(followedStoreNoticeText(item('service'))).toBe(
      'CPSU Supplies published a new service: Notebook.');
    expect(followedStoreNoticeText(null)).toContain('A store you follow');
  });
  test('clicking a notification opens only a valid internal listing URL', () => {
    expect(followedStoreNoticeTarget(item('physical_product'))).toBe('/listings/47');
    expect(followedStoreNoticeTarget(item('physical_product', 'https://evil.invalid'))).toBeNull();
    expect(followedStoreNoticeTarget(item('physical_product', -1))).toBeNull();
    expect(followedStoreNoticeTarget(item('physical_product', 0))).toBeNull();
    expect(followedStoreNoticeTarget(null)).toBeNull();
  });
  test('label and icon identify following activity instead of messages', () => {
    expect(FOLLOWED_STORE_NOTICE_KIND).toEqual({
      title: 'New from a followed store', label: 'Following', icon: 'store', tone: 'listing',
    });
  });
});
