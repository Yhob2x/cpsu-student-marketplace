import { expect, test } from 'bun:test';
import { filterScrollState } from '../src/explore-scroll-options';
test('scroll cue appears only for overflowing option rows and tracks both ends', () => {
  expect(filterScrollState(200, 250, 0)).toEqual({overflowing:false,previous:false,next:false});
  expect(filterScrollState(600, 300, 0)).toEqual({overflowing:true,previous:false,next:true});
  expect(filterScrollState(600, 300, 150)).toEqual({overflowing:true,previous:true,next:true});
  expect(filterScrollState(600, 300, 300)).toEqual({overflowing:true,previous:true,next:false});
});
