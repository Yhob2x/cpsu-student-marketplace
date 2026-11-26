import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeListings } from '../../resources/js/lib/listings/home-listings';

test('fresh listings include the newest items when there are no popular listings', () => {
  const newest = { id: 3 };
  const older = { id: 2 };
  const rails = selectHomeListings([newest, older], [], [newest, { id: 1 }]);
  assert.deepEqual(rails.popular, []);
  assert.deepEqual(rails.fresh, [newest, older]);
  assert.deepEqual(rails.trending, [newest, older]);
  assert.deepEqual(rails.services, [{ id: 1 }]);
});

test('Trending shows up to ten distinct listings, with ranked listings first', () => {
  const fresh = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));
  const popular = [{ id: 12 }, { id: 2 }, { id: 15 }, { id: 4 }, { id: 16 }];
  const rails = selectHomeListings(fresh, popular, [fresh[8], fresh[9]]);

  assert.deepEqual(rails.trending, [...popular, fresh[0], fresh[2], fresh[4], fresh[5], fresh[6]]);
  assert.deepEqual(rails.fresh, fresh.slice(0, 8));
  assert.deepEqual(rails.services, [fresh[8], fresh[9]]);
  assert.deepEqual(selectHomeListings(fresh, [], [fresh[8], fresh[9]]).services, []);
});

test('a popular new listing remains in Fresh listings', () => {
  const newest = { id: 3 };
  const rails = selectHomeListings([newest], [newest], [newest]);
  assert.deepEqual(rails.popular, [newest]);
  assert.deepEqual(rails.fresh, [newest]);
  assert.deepEqual(rails.services, []);
});
