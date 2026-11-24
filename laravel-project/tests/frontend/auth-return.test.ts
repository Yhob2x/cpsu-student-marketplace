import { test, expect } from 'bun:test';
import { safeLoginReturn } from '../../resources/js/auth-return';

test('sign-in accepts an exact listing URL and existing protected destinations', () => {
  expect(safeLoginReturn('/listings/42')).toBe('/listings/42');
  expect(safeLoginReturn('/stores/3')).toBe('/stores/3');
  expect(safeLoginReturn('/store/campus-crafts')).toBe('/store/campus-crafts');
  expect(safeLoginReturn('/store/campus-crafts--3')).toBe('/store/campus-crafts--3');
  expect(safeLoginReturn('/store/%E6%9D%B1%E4%BA%AC-%E5%BA%97')).toBe('/store/%E6%9D%B1%E4%BA%AC-%E5%BA%97');
  expect(safeLoginReturn('/saved')).toBe('/saved');
  expect(safeLoginReturn('/inquiries/7')).toBe('/inquiries/7');
  expect(safeLoginReturn('/inquiries')).toBe('/inquiries');
  expect(safeLoginReturn('/dashboard')).toBe('/dashboard');
});

test('sign-in rejects external, encoded, and malformed return destinations', () => {
  for (const value of ['//evil.example', 'https://evil.example', '/listings/0', '/listings/-1',
    '/listings/1/../../admin', '/listings/1?next=//evil.example', '/listings/%2F%2Fevil.example', '/admin',
    '/dashboard/../admin', '/dashboard?next=//evil.example', '/dashboard/settings',
    '/stores/0', '/stores/-1', '/stores/1?redirect=https://evil.example', '/stores/%2e%2e',
    '/store/../admin', '/store/%2F%2Fevil.example', '/store/campus-crafts?next=//evil.example']) {
    expect(safeLoginReturn(value)).toBe('/');
  }
});
