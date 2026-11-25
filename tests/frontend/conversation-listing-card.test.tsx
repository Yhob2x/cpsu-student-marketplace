import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { ConversationListingCard, type ConversationListing } from '../../resources/js/components/chat/conversation-listing-card';

const product: ConversationListing = {
  id: 71, title: 'Student laptop', type: 'physical_product',
  price: 18500, priceBasis: 'per item', condition: 'like_new',
  availability: 'available', imageUrl: '/api/v1/media/28',
};

function markup(listing: ConversationListing, compact = true) {
  return renderToStaticMarkup(<StaticRouter location="/">
    <ConversationListingCard listing={listing} compact={compact} />
  </StaticRouter>);
}

describe('conversation listing context shared by full and floating chat', () => {
  test('compact product shows authentic listing fields with a link', () => {
    const output = markup(product);
    expect(output).toContain('Student laptop');
    expect(output).toContain('18,500');
    expect(output).toContain('per item');
    expect(output).toContain('like new');
    expect(output).toContain('Available');
    expect(output).toContain('/api/v1/media/28');
    expect(output).toContain('href="/listings/71"');
    expect(output).toContain('is-compact');
  });
  test('unavailable listing retains context without an invalid public link or photo', () => {
    const output = markup({ ...product, availability: 'unavailable', imageUrl: null });
    expect(output).toContain('Listing unavailable');
    expect(output).toContain('Listing cannot be opened');
    expect(output).not.toContain('href="/listings/71"');
    expect(output).toContain('No photo');
  });
  test('service context works and full-page presentation remains unchanged', () => {
    const output = markup({ ...product, type: 'service', condition: null, priceBasis: 'per hour' }, false);
    expect(output).toContain('Service');
    expect(output).toContain('Listing details');
    expect(output).toContain('Listing ID:');
    expect(output).not.toContain('is-compact');
    expect(output).toContain('href="/listings/71"');
  });
});
