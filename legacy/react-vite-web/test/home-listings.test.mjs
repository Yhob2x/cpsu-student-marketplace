import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeListings } from '../src/home-listings.ts';

test('fresh listings include the newest items when there are no popular listings', () => {
  const newest = { id: 3 };
  const older = { id: 2 };
  const rails = selectHomeListings([newest, older], [], [newest, { id: 1 }]);
  assert.deepEqual(rails.popular, []);
  assert.deepEqual(rails.fresh, [newest, older]);
  assert.deepEqual(rails.services, [{ id: 1 }]);
});

test('a popular new listing remains in Fresh listings', () => {
  const newest = { id: 3 };
  const rails = selectHomeListings([newest], [newest], [newest]);
  assert.deepEqual(rails.popular, [newest]);
  assert.deepEqual(rails.fresh, [newest]);
  assert.deepEqual(rails.services, []);
});
