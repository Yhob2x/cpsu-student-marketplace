import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { StorefrontView, type PublicStorefront } from '../../src/pages-storefront';
import { Icon } from '../../src/icons';
import type { Listing } from '../../src/pages-public';
import '../../src/styles.css';
import '../../src/storefront-theme.css';
import '../../src/storefront.css';
import '../../src/hierarchy-polish.css';
import '../../src/typography.css';
import '../../src/store-followers.css';
import '../../src/storefront-page-polish.css';
import '../../src/floating-chat.css';

const names = [
 'Graduation portrait package','Digital illustration commissions','One-on-one math tutoring',
 'Pre-loved Calculus textbook','Logo and poster design','Weekend food tray orders',
 'Computer troubleshooting','Notes and reviewers','Photography session',
];
const categories = ['Photography & video','Design & creative','Tutoring','Books & notes (pre-loved)','Design & creative','Food & drinks','Tech & IT help'];
const store: PublicStorefront = {
 id: -99, slug:'synthetic-store', storeName:'Synthetic Campus Studio',
 description:'This is a test-only storefront to review responsive layout, actions and listing cards.',
 badge:'Verified CPSU community member', createdAt:'2026-11-05T08:00:00Z',
 listingCount:21, follow:{count:0,isFollowing:false,available:true},
 campus:{code:'CAUAYAN',name:'Cauayan Campus'},
 listings:Array.from({length:21},(_,i)=>({
  id:i+1, title:names[i%names.length], description:'Synthetic listing for visual tests',
  type:i%4===3?'physical_product':'service', category:{name:categories[i%categories.length]},
 })) as Listing[],
};
createRoot(document.getElementById('root')!).render(
 <MemoryRouter><main className="wrap"><StorefrontView store={store} isOwner={false} canFollow onFollow={()=>{}}
  followBusy={false} followMessage="" canChat signedIn={false} onChatSignIn={()=>{}} onChat={()=>{}}
  chatBusy={false} chatError="" renderListing={item=><article className="product-card" key={item.id}>
   <div className="product-photo" style={{background:['#94afc4','#c3a4b1','#adc4ae','#d4b796'][item.id%4]}}>
    <span className="listing-kind">{item.type==='service'?'Service':'Product'}</span>
   </div>
   <div className="body"><h3>{item.title}</h3><p className="product-category">{item.category.name}</p><strong className="price">₱ 250</strong></div>
  </article>}/></main><button type="button" className="floating-chat">Chat</button></MemoryRouter>);
