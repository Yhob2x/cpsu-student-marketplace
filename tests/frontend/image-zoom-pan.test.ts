import { describe, expect, test } from 'bun:test';
import { anchorPhotoZoom, clampZoom, fittedPhotoSize, limitPhotoPan } from '../../resources/js/components/listings/image-zoom';

describe('fullscreen image zoom geometry', () => {
  test('calculates the full contained image for landscape and portrait photos', () => {
    expect(fittedPhotoSize(2400, 1600, 1349, 726)).toEqual({ width: 1089, height: 726 });
    expect(fittedPhotoSize(1000, 2000, 1360, 680)).toEqual({ width: 340, height: 680 });
    expect(fittedPhotoSize(0, 0, 1360, 680)).toEqual({ width: 0, height: 0 });
  });
  test('fits the complete photo and disables panning at 100%', () => {
    expect(limitPhotoPan({ x: 80, y: -90 }, 1, 700, 500, 1000, 700)).toEqual({ x: 0, y: 0 });
  });
  test('limits drag to actual visible photo extents, not the oversized viewer', () => {
    // A 700x500 image doubled inside a 1000x700 viewer has 200px x and 150px y of available panning.
    expect(limitPhotoPan({ x: 600, y: -600 }, 2, 700, 500, 1000, 700)).toEqual({ x: 200, y: -150 });
    expect(limitPhotoPan({ x: -100, y: 60 }, 2, 700, 500, 1000, 700)).toEqual({ x: -100, y: 60 });
  });
  test('does not drag an image that remains narrower than its viewer', () => {
    expect(limitPhotoPan({ x: 80, y: 20 }, 2, 200, 500, 1000, 700)).toEqual({ x: 0, y: 20 });
  });
  test('keeps the pointer position steady while zooming and pinch moving', () => {
    expect(anchorPhotoZoom(1, 2, { x: 0, y: 0 }, { x: 100, y: -40 })).toEqual({ x: -100, y: 40 });
    expect(anchorPhotoZoom(2, 3, { x: 20, y: -10 }, { x: 50, y: 60 }, { x: 70, y: 80 }))
      .toEqual({ x: 25, y: -25 });
    expect(clampZoom(10)).toBe(4);
  });
});
