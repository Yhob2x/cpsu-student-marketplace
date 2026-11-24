import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ListingGallery } from '../../resources/js/components/listings/listing-gallery';

describe('product gallery rendering', () => {
  test('three photos create a swipeable carousel with counter, buttons and three thumbnails', () => {
    const html = renderToStaticMarkup(<ListingGallery title="Study Desk" photos={['/a.webp', '/b.webp', '/c.webp']} />);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('Swipe through 3 photos of Study Desk');
    expect(html).toContain('1 / 3');
    expect(html).toContain('aria-label="Previous photo"');
    expect(html).toContain('aria-label="Next photo"');
    expect(html).toContain('aria-label="Show photo 1 of 3"');
    expect(html).toContain('aria-label="Show photo 2 of 3"');
    expect(html).toContain('aria-label="Show photo 3 of 3"');
    expect((html.match(/class="product-gallery-slide"/g) ?? []).length).toBe(3);
    expect((html.match(/class="product-gallery-thumb"/g) ?? []).length).toBe(3);
  });

  test('one photo hides navigation rather than showing dead controls', () => {
    const html = renderToStaticMarkup(<ListingGallery title="Notebook" photos={['/single.webp']} />);
    expect(html).toContain('Photo 1 of 1: Notebook');
    expect(html).not.toContain('Next photo');
    expect(html).not.toContain('product-gallery-thumbnails');
  });

  test('zero photos show an accessible empty state', () => {
    const html = renderToStaticMarkup(<ListingGallery title="Draft" photos={[]} />);
    expect(html).toContain('No listing photos yet');
    expect(html).not.toContain('product-gallery-arrow');
  });
});
