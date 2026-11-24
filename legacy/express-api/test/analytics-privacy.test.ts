import { expect, test } from 'bun:test';
import { suppressSmallCount } from '../src/analytics-privacy.js';

test('admin analytics suppresses all nonzero counts below five but reports genuine zero', () => {
  expect([0, 1, 2, 3, 4, 5, 10].map(n => suppressSmallCount(n)))
    .toEqual([0, '<5', '<5', '<5', '<5', 5, 10]);
  expect(() => suppressSmallCount(-1)).toThrow(RangeError);
});
