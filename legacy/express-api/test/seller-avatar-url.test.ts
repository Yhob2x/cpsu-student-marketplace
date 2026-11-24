import { describe, expect, test } from 'bun:test';
import { sellerAvatarUrl } from '../src/seller-avatar-url.js';

describe('seller avatar URL versioning', () => {
  test('no avatar returns no image URL', () => {
    expect(sellerAvatarUrl(7, null)).toBeNull();
    expect(sellerAvatarUrl(7, undefined)).toBeNull();
  });

  test('different replacements change public image URL without exposing file path', () => {
    const oldPath='gdrive:sample-old-private-identifier';
    const newPath='gdrive:sample-new-private-identifier';
    const first=sellerAvatarUrl(12,oldPath);
    const second=sellerAvatarUrl(12,newPath);
    expect(first).toMatch(/^\/api\/v1\/media\/seller-avatar\/12\?v=[a-f0-9]{16}$/);
    expect(second).toMatch(/^\/api\/v1\/media\/seller-avatar\/12\?v=[a-f0-9]{16}$/);
    expect(second).not.toBe(first);
    expect(second).not.toContain(newPath);
    expect(second).not.toContain('gdrive:');
  });

  test('stable reference remains stable between requests and differs by store', () => {
    const path='1a2b3c4d5e6f77889900112233445566.webp';
    expect(sellerAvatarUrl(1,path)).toBe(sellerAvatarUrl(1,path));
    expect(sellerAvatarUrl(1,path)).not.toBe(sellerAvatarUrl(2,path));
  });
});