import { test, expect } from 'bun:test';
import { ApiError } from '../src/api';
import { isPublicNotFound, publicResourceLoadMessage } from '../src/public-resource-error';

test('only a real 404 is shown as an unavailable public resource', () => {
  expect(isPublicNotFound(new ApiError(404, 'not_found'))).toBe(true);
  expect(isPublicNotFound(new ApiError(500, 'error'))).toBe(false);
  expect(isPublicNotFound(new ApiError(403, 'forbidden'))).toBe(false);
  expect(isPublicNotFound(new TypeError('Failed to fetch'))).toBe(false);
});

test('public listing and store errors explain HTTP 429 without misdiagnosing a network outage', () => {
  expect(publicResourceLoadMessage(new ApiError(429, 'rate_limited'))).toContain('Wait about a minute');
  expect(publicResourceLoadMessage(new ApiError(500, 'internal_error'))).toContain('server or connection');
});
