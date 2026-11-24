import test from 'node:test';
import assert from 'node:assert/strict';
import { photoIndexFromScroll, adjacentPhotoIndex, clampPhotoIndex } from '../src/gallery-navigation.ts';

test('horizontal scroll position tracks the visible full-width photo', () => {
  assert.equal(photoIndexFromScroll(0, 320, 5), 0);
  assert.equal(photoIndexFromScroll(190, 320, 5), 1);
  assert.equal(photoIndexFromScroll(325, 320, 5), 1);
  assert.equal(photoIndexFromScroll(640, 320, 5), 2);
  assert.equal(photoIndexFromScroll(1260, 320, 5), 4);
  assert.equal(photoIndexFromScroll(5000, 320, 5), 4);
});

test('navigation arrows stop at the first and last photo', () => {
  assert.equal(adjacentPhotoIndex(0, -1, 5), 0);
  assert.equal(adjacentPhotoIndex(0, 1, 5), 1);
  assert.equal(adjacentPhotoIndex(3, 1, 5), 4);
  assert.equal(adjacentPhotoIndex(4, 1, 5), 4);
  assert.equal(adjacentPhotoIndex(0, 1, 1), 0);
  assert.equal(clampPhotoIndex(99, 0), 0);
});

test('empty or invalid scroll widths do not produce broken photo indices', () => {
  assert.equal(photoIndexFromScroll(150, 0, 5), 0);
  assert.equal(photoIndexFromScroll(NaN, 350, 5), 0);
  assert.equal(photoIndexFromScroll(150, NaN, 5), 0);
});
