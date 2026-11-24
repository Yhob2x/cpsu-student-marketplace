import { test, expect } from 'bun:test';
import { coverFirst } from '../../resources/js/photo-cover-order';

test('selected cover uploads first without mutating the picker order', () => {
  const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')];
  const ordered = coverFirst(files, 2);
  expect(ordered.map(file => file.name)).toEqual(['c.jpg', 'a.jpg', 'b.jpg']);
  expect(files.map(file => file.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
});

test('empty or stale cover selection keeps the original order', () => {
  const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
  expect(coverFirst([], 0)).toEqual([]);
  expect(coverFirst(files, 99)).toEqual(files);
  expect(coverFirst(files, -1)).toEqual(files);
});
