async page => {
  const origin = 'http://localhost:5173';
  const contentResponse = await page.request.get(origin + '/api/v1/home-page');
  if (!contentResponse.ok()) throw new Error('Public homepage content unavailable for synthetic fixture');
  const publishedContent = await contentResponse.json();
  const draft = { ...publishedContent, images: { hero: null, steps: null, cta: null } };
  const adminState = { draft, published: null, revision: 5, publishedRevision: 4, publishedAt: null };
  const results = [];
  const mockFor = async (me) => {
    await page.route('**/api/v1/**', async route => {
      const url = new URL(route.request().url());
      const key = url.pathname.replace('/api/v1', '');
      const method = route.request().method();
      if (method !== 'GET' && key !== '/auth/refresh') {
        return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:{code:'synthetic_read_only'}})});
      }
      const values = {
        '/auth/refresh': {accessToken:'synthetic-browser-only'},
        '/me': me,
        '/saved': [],
        '/notifications/unread-count': {total:0,messages:0},
        '/inquiries': [],
        '/admin/review-queue': {listings:me?.roles?.some(role=>role.role==='campus_reviewer')?[{id:77,title:'Product',description:'Nice item',price:100,store:'Synthetic Store',campus:'Main',category:'Books',images:[],flags:[]}]:[],affiliations:[],reportsPending:0},
        '/admin/reports': [],
        '/admin/analytics/overview': {note:'Synthetic browser preview',campuses:[]},
        '/admin/transactions': {items:[],total:0},
        '/admin/users': {items:[],total:0,page:1},
        '/admin/audit-logs': {items:[],nextCursor:null},
        '/admin/content/home-page': adminState,
        '/admin/content/guidelines': {draftBody:'',publishedBody:null,publishedAt:null},
        '/admin/content/announcements': {items:[]},
        '/campuses': [{id:1,name:'Main Campus'}],
        '/push/config': {enabled:false,deliveryEnabled:false,publicKey:null},
        '/push/preferences': {messages:false, transactions:false},
        '/announcements': {items:[]},
        '/listings': {items:[],total:0,page:1,pageSize:20},
        '/listings/fresh': {items:[]},
        '/listings/popular': {items:[]},
        '/stores/most-followed': {available:false,items:[]},
        '/categories': [],
        '/home-page': publishedContent,
      };
      const response = values[key] ?? (key.startsWith('/home-page/images/') ? null : []);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    });
  };
  const student = {id:900001,email:'synthetic.student@example.invalid',displayName:'Synthetic Student',
    storeId:null,roles:[],affiliations:[{id:41,campus:{id:1,name:'Main Campus'},status:'verified'}]};
  await mockFor(student);
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin + '/');
  await page.getByRole('button',{name:'Sign out'}).waitFor();
  const chat = page.locator('.floating-chat');
  await chat.click();
  await page.getByRole('dialog',{name:'Messages quick view'}).waitFor();
  const inbox = await page.getByText('No conversations yet').isVisible();
  if (!inbox) throw new Error('Synthetic student chat empty state failed');
  await page.getByRole('button',{name:'Close chat'}).click();
  results.push('student signed-in UI: floating chat opens and closes, empty state works');
  await page.unroute('**/api/v1/**');

  const globalAdmin = {id:900002,email:'synthetic.admin@example.invalid',displayName:'Synthetic Administrator',
    storeId:null,roles:[{role:'university_admin',campusId:null}],affiliations:[]};
  await mockFor(globalAdmin);
  await page.goto(origin + '/admin');
  await page.getByRole('button',{name:'Sign out'}).waitFor();
  await page.getByRole('combobox',{name:'Workspace section'}).selectOption('content');
  await page.getByRole('heading',{name:'Editorial content'}).waitFor();
  await page.getByRole('heading',{name:'Homepage photos'}).waitFor();
  const verification = await page.evaluate(() => {
    const editor=document.querySelector('.home-admin-editor');
    const photos=editor?.querySelector('.home-admin-images');
    const action=editor?.querySelector('.home-admin-publish-actions');
    const publish=action?.querySelector('button');
    return {label:editor?.querySelector('.home-admin-status')?.textContent,
      followsPhotos: photos?.contains(action) && action?.previousElementSibling?.classList.contains('home-admin-image-grid'),enabled:publish && !publish.disabled,
      button:publish?.textContent, chatHidden:!document.querySelector('.floating-chat')};
  });
  if (verification.label!=='Unpublished draft changes' || !verification.followsPhotos ||
      !verification.enabled || !verification.chatHidden ||
      !verification.button?.includes('Publish saved draft')) {
    throw new Error('Synthetic global admin publish hierarchy failed: '+JSON.stringify(verification));
  }
  results.push('university admin UI: unpublished draft labeled; Publish placed after photos; no staff chat');
  await page.unroute('**/api/v1/**');

  const reviewer = {id:900003,email:'synthetic.reviewer@example.invalid',displayName:'Synthetic Reviewer',
    storeId:null,roles:[{role:'campus_reviewer',campusId:1}],affiliations:[]};
  await mockFor(reviewer);
  await page.goto(origin + '/admin');
  await page.getByRole('button',{name:'Sign out'}).waitFor();
  await page.getByRole('heading',{name:'Campus review workspace'}).waitFor();
  const nav = await page.getByRole('combobox',{name:'Workspace section'}).locator('option').allTextContents();
  if (nav.some(v=>v==='Content' || v==='Students')) throw new Error('Reviewer has global administration navigation');
  await page.getByText('Content clarity review').waitFor();
  const staffSearchVisible = await page.locator('header.top .head-search input').isVisible();
  if(staffSearchVisible) throw new Error('Global search still competes with mobile reviewer controls');
  await page.getByRole('link',{name:'Search marketplace listings'}).click();
  await page.locator('header.top .head-search input').waitFor();
  results.push('campus reviewer UI: scoped navigation, listing clarity guidance, compact header and accessible marketplace search');
  await page.unroute('**/api/v1/**');
  return results;
}
