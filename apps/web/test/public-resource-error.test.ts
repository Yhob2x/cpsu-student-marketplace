import { test, expect } from 'bun:test';
import { ApiError } from '../src/api';
import { isPublicNotFound } from '../src/public-resource-error';

test('only a real 404 is shown as an unavailable public resource', () => {
  expect(isPublicNotFound(new ApiError(404, 'not_found'))).toBe(true);
  expect(isPublicNotFound(new ApiError(500, 'error'))).toBe(false);
  expect(isPublicNotFound(new ApiError(403, 'forbidden'))).toBe(false);
  expect(isPublicNotFound(new TypeError('Failed to fetch'))).toBe(false);
});
