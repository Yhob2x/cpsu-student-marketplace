import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { StorefrontView, type PublicStorefront } from '../../resources/js/components/stores/storefront-view';
import type { Listing } from '../../resources/js/types/listing';

const sample = {
  id: 88, storeName: 'Synthetic Campus Store', description: 'For local tests only',
  badge: 'Active seller', badgeReason: 'Based on 1 published listing. Activity label only.', createdAt: '2026-11-17T00:00:00Z',
  listingCount: 1, appreciationCount: 37, follow: {count: 2, isFollowing: false, available: true},
  campus: {code:'MAIN', name:'CPSU Main Campus'},
  listings: [{id: 10, title:'Textbook', category:{name:'Books'},type:'physical_product'} as Listing],
} satisfies PublicStorefront;
function draw(overrides:Partial<PublicStorefront>={}, opts:{canChat?:boolean;signedIn?:boolean;isOwner?:boolean;followBusy?:boolean;followMessage?:string;report?:boolean}={}) {
  const store={...sample,...overrides};
  return renderToStaticMarkup(
    <StaticRouter location="/">
      <StorefrontView store={store} isOwner={opts.isOwner ?? false}
        canFollow={!opts.isOwner} onFollow={()=>{}} followBusy={opts.followBusy ?? false} followMessage={opts.followMessage ?? ""}
        canChat={opts.canChat ?? true} signedIn={opts.signedIn ?? false}
        onChatSignIn={()=>{}} onChat={()=>{}} chatBusy={false} chatError=""
        renderListing={item=><article data-item={item.id}>{item.title}</article>}
        reportSellerSlot={opts.report ? <div className="storefront-report"><button type="button">Report this seller</button></div> : undefined}/>
    </StaticRouter>
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
  test('shows the published-listing appreciation total between listings and followers',()=>{
    const html = draw();
    const stats = html.match(/<div class="storefront-facts">([\s\S]*?)<\/section>/)?.[1] ?? '';
    const labels = ['Listings', 'Appreciations', 'Followers', 'Following'];
    expect(stats).toContain('storefront-appreciations-fact');
    expect(stats).toMatch(/Appreciations<\/span><strong>37<\/strong>/);
    for (let i = 0; i < labels.length; i++) {
      expect(stats).toContain(labels[i]);
      if (i > 0) expect(stats.indexOf(labels[i])).toBeGreaterThan(stats.indexOf(labels[i - 1]));
    }
    expect(stats).not.toContain('Store opened');
    expect(stats).not.toContain('>Campus<');
    expect(html).toContain('Opened Nov 2026');
  });
  test('empty store prevents initiating a listing-scoped chat without fabricating listings',()=>{
    const html=draw({listings:[],listingCount:0});
    expect(html).toContain('Chat with seller');
    expect(html).toContain('Messaging becomes available once this store has a published, available listing.');
    expect(html).toMatch(/Chat with seller/);
  });
  test('follow states preserve the same button slot and keep status text outside action row',()=>{
    const followed=draw({follow:{count:3,isFollowing:true,available:true}}, {followMessage:'You are following this store.'});
    const unfollowed=draw({follow:{count:2,isFollowing:false,available:true}}, {followMessage:'You unfollowed this store.'});
    const updating=draw({}, {followBusy:true});
    const actionRow=(html:string)=>html.match(/<div class="storefront-owner-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';
    for(const html of [followed,unfollowed,updating]) {
      expect(actionRow(html)).toContain('storefront-follow-action');
      expect(actionRow(html)).not.toContain('storefront-follow-feedback');
    }
    expect(followed).toContain('aria-pressed="true"');
    expect(unfollowed).toContain('aria-pressed="false"');
    expect(actionRow(followed)).toContain('aria-label="Following"');
    expect(actionRow(unfollowed)).toContain('aria-label="Follow"');
    expect(actionRow(updating)).toContain('aria-label="Updating follow"');
    expect(actionRow(followed)).not.toContain('Following</button>');
    expect(followed.indexOf('storefront-follow-notices')).toBeGreaterThan(followed.indexOf('storefront-owner-actions'));
    expect(followed.indexOf('storefront-follow-notices')).toBeLessThan(followed.indexOf('storefront-facts'));
  });
  test('owner edit stays available and redundant browse action is removed',()=>{
    const html = draw({}, {isOwner:true,canChat:false});
    const actions = html.match(/<div class="storefront-owner-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(actions).toContain('class="btn storefront-edit-action"');
    expect(actions).toContain('Edit my store');
    expect(actions).not.toContain('storefront-browse-action');
    expect(html).toContain('id="storefront-listings"');
  });
  test('buyer store actions are icons with accessible names, without browse link',()=>{
    const html = draw();
    const actions = html.match(/<div class="storefront-owner-actions">([\s\S]*?)<\/div>/)?.[1] ?? '';
    expect(actions).toContain('aria-label="Follow"');
    expect(actions).toContain('aria-label="Chat with seller"');
    expect(actions).not.toContain('Appreciate this store');
    expect(actions).toContain('storefront-icon-action');
    expect(actions).not.toContain('Browse listings');
    expect(actions).not.toContain('Chat with seller</button>');
    expect(actions).not.toContain('Follow</button>');
  });
  test('seller reporting shares the about section instead of creating a separate card',()=>{
    const html=draw({}, { report:true });
    const about=html.slice(html.indexOf('class="storefront-about"'));
    expect(about).toContain('About the store');
    expect(about).toContain('Report this seller');
    expect(html.match(/Report this seller/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Report seller"');
  });
  test('store owner or staff does not get buyer chat action',()=>{
    expect(draw({}, {isOwner:true,canChat:false})).not.toContain('Chat with seller');
    expect(draw({}, {canChat:false})).not.toContain('Chat with seller');
  });
});
