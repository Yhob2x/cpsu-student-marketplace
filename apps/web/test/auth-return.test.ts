import { test, expect } from 'bun:test';
import { safeLoginReturn } from '../src/auth-return';

test('sign-in accepts an exact listing URL and existing protected destinations', () => {
  expect(safeLoginReturn('/listings/42')).toBe('/listings/42');
  expect(safeLoginReturn('/saved')).toBe('/saved');
  expect(safeLoginReturn('/inquiries/7')).toBe('/inquiries/7');
});

test('sign-in rejects external, encoded, and malformed return destinations', () => {
  for (const value of ['//evil.example', 'https://evil.example', '/listings/0', '/listings/-1',
    '/listings/1/../../admin', '/listings/1?next=//evil.example', '/listings/%2F%2Fevil.example', '/admin']) {
    expect(safeLoginReturn(value)).toBe('/');
  }
});
