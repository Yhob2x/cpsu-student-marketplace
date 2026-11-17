import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontView, type PublicStorefront } from '../src/pages-storefront';
import type { Listing } from '../src/pages-public';

const sample = {
  id: 88, storeName: 'Synthetic Campus Store', description: 'For local tests only',
  badge: 'Verified CPSU community member', createdAt: '2026-11-17T00:00:00Z',
  listingCount: 1, follow: {count: 2, isFollowing: false, available: true},
  campus: {code:'MAIN', name:'CPSU Main Campus'},
  listings: [{id: 10, title:'Textbook', category:{name:'Books'},type:'physical_product'} as Listing],
} satisfies PublicStorefront;
function draw(overrides:Partial<PublicStorefront>={}, opts:{canChat?:boolean;signedIn?:boolean;isOwner?:boolean}={}) {
  const store={...sample,...overrides};
  return renderToStaticMarkup(
    <MemoryRouter>
      <StorefrontView store={store} isOwner={opts.isOwner ?? false}
        canFollow={!opts.isOwner} onFollow={()=>{}} followBusy={false} followMessage=""
        canChat={opts.canChat ?? true} signedIn={opts.signedIn ?? false}
        onChatSignIn={()=>{}} onChat={()=>{}} chatBusy={false} chatError=""
        renderListing={item=><article data-item={item.id}>{item.title}</article>}/>
    </MemoryRouter>
  );
}
describe('public store messaging CTA and real categories',()=>{
  test('non-owner sees accessible chat action and real listing category',()=>{
    const html=draw();
    expect(html).toContain('Chat with seller');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Books');
    expect(html).toContain('Followers');
    expect(html).toContain('2');
    expect(html).not.toContain('Message Synthetic Campus Store');
  });
  test('empty store prevents initiating a listing-scoped chat without fabricating listings',()=>{
    const html=draw({listings:[],listingCount:0});
    expect(html).toContain('Chat with seller');
    expect(html).toContain('Messaging becomes available once this store has a published, available listing.');
    expect(html).toMatch(/Chat with seller/);
  });
  test('store owner or staff does not get buyer chat action',()=>{
    expect(draw({}, {isOwner:true,canChat:false})).not.toContain('Chat with seller');
    expect(draw({}, {canChat:false})).not.toContain('Chat with seller');
  });
});
