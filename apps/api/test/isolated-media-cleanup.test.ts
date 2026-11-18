import { expect, test } from 'bun:test';
import { newTestMediaNames } from './isolated-media-cleanup';

test('identifies only newly created sanitized test media', () => {
  const before = new Set(['00112233445566778899aabbccddeeff.webp', 'keep.txt']);
  const after = [
    '00112233445566778899aabbccddeeff.webp',
    '11223344556677889900aabbccddeeff.webp',
    '22334455667788990011aabbccddeeff.upload',
    'keep.txt',
  ];
  expect(newTestMediaNames(before, after)).toEqual([
    '11223344556677889900aabbccddeeff.webp',
    '22334455667788990011aabbccddeeff.upload',
  ]);
});
test('refuses unexpected paths/names rather than deleting unrecognized content', () => {
  expect(() => newTestMediaNames(new Set(), ['../outside.txt'])).toThrow();
  expect(() => newTestMediaNames(new Set(), ['not-a-media-file.txt'])).toThrow();
});
