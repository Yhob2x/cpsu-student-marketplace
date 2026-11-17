import { describe, expect, test } from 'bun:test';
import { publicListingSelect } from '../src/routes/public.js';

describe('public listing selection across approval-gated avatar migrations', () => {
  test('does not select the optional avatar column on an older database', () => {
    const selected = publicListingSelect(false);
    expect('avatarPath' in selected.seller.select).toBe(false);
    expect(selected.seller.select.owner.select.status).toBe(true);
    expect(selected.media.select.position).toBe(true);
    expect(selected.deletedAt).toBe(true);
    expect(selected.status).toBe(true);
  });
  test('restores avatar projection on a database with the approved column', () => {
    const selected = publicListingSelect(true);
    expect(selected.seller.select.avatarPath).toBe(true);
    expect(selected.seller.select.approvalStatus).toBe(true);
  });
});