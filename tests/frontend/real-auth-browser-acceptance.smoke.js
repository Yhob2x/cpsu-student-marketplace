async page => {
  const site='http://127.0.0.1:5187';
  const results=[];
  const password='TestPassphrase-Stage1-2026!';
  const loginAs = async email => {
    await page.goto(site+'/login');
    await page.getByRole('textbox',{name:'Email'}).fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('form.auth-form button.btn').click();
    await page.getByRole('button',{name:'Sign out'}).waitFor({timeout:12000});
  };
  const logout = async () => {
    await page.getByRole('button',{name:'Sign out'}).click();
    await page.getByRole('link',{name:'Sign in'}).first().waitFor({timeout:12000});
  };
  const publicListingResponse = await page.request.get(site+'/api/v1/listings?pageSize=50');
  if (!publicListingResponse.ok()) throw new Error('Synthetic listing discovery unavailable');
  const listingResponse = await publicListingResponse.json();
  const published=listingResponse.items.find(l=>l.title==='Published Stage1 Book');
  if (!published) throw new Error('Prepared synthetic listing missing');
  await page.setViewportSize({width:390,height:844});
  await page.goto(site+'/listings/'+published.id);
  await page.getByRole('heading',{name:published.title}).waitFor();
  results.push('Guest opens real synthetic published listing');
  await page.goto(site+'/');
  const categoryAction=page.locator('.category-section .category-head a');
  await categoryAction.scrollIntoViewIfNeeded();
  const collision=await page.evaluate(()=>{
    const chat=document.querySelector('.floating-chat')?.getBoundingClientRect();
    const action=document.querySelector('.category-section .category-head a')?.getBoundingClientRect();
    const dock=document.querySelector('.tabbar')?.getBoundingClientRect();
    if(!chat||!action||!dock) return {ok:false,reason:'missing layout targets'};
    const overlaps=Math.max(0,Math.min(chat.right,action.right)-Math.max(chat.left,action.left))*Math.max(0,Math.min(chat.bottom,action.bottom)-Math.max(chat.top,action.top));
    return {ok:overlaps===0 && chat.top>=dock.top-2 && document.documentElement.scrollWidth<=innerWidth+1,overlap:overlaps};
  });
  if(!collision.ok) throw Error('390px floating chat interferes with category action: '+JSON.stringify(collision));
  await categoryAction.click();
  await page.waitForURL('**/explore');
  results.push('Guest mobile 390px category action remains unobstructed and navigates to Explore');
  const rail=page.locator('.explore-inline-filter-group').first().locator('.explore-inline-filter-options');
  await rail.waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('.explore-inline-filter-group')[0]?.querySelectorAll('button[aria-pressed]').length >= 3);
  const overflows=await rail.evaluate(el=>el.scrollWidth>el.clientWidth+3);
  if(overflows){
    const forward=page.getByRole('button',{name:'More campus options'});
    await forward.waitFor();
    await forward.click();
    await page.waitForFunction(()=>document.querySelector('.explore-inline-filter-group .explore-inline-filter-options')?.scrollLeft>3);
  }
  results.push('Guest Explore campus filters expose navigation when overflowing');

  await loginAs('buyer@stage1.invalid');
  await page.reload();
  await page.getByRole('button',{name:'Sign out'}).waitFor({timeout:12000});
  await page.goto(site+'/stores/'+published.seller.id);
  const follow=page.getByRole('button',{name:'Follow',exact:true});
  await follow.waitFor();
  await follow.click();
  await page.getByRole('button',{name:'Following',exact:true}).waitFor();
  const chat=page.locator('.floating-chat');
  await chat.click();
  await page.getByRole('dialog',{name:'Messages quick view'}).waitFor();
  await page.getByRole('button',{name:'Close chat'}).click();
  results.push('Buyer real login/session refresh, follow store, floating message open/close');
  await logout();

  await loginAs('seller@stage1.invalid');
  await page.goto(site+'/dashboard');
  await page.getByRole('button',{name:'View 1 followers'}).waitFor();
  await page.getByRole('button',{name:'View 1 followers'}).click();
  await page.getByRole('dialog',{name:'Store connections'}).getByText('Test buyer').waitFor();
  await page.getByRole('button',{name:'Close connections'}).click();
  results.push('Seller real login views new follower privately in My Store');
  await logout();

  await loginAs('reviewer-a@stage1.invalid');
  await page.goto(site+'/admin');
  await page.getByRole('heading',{name:'Campus review workspace'}).waitFor();
  const options=await page.getByRole('combobox',{name:'Workspace section'}).locator('option').allTextContents();
  if(options.some(t=>/^Students$|^Content$/.test(t))) throw new Error('Reviewer exposed university management');
  if(await page.locator('header.top .head-search').isVisible()) throw Error('Reviewer marketplace search still dominates admin header');
  const marketLink=page.getByRole('link',{name:'Search marketplace listings'});
  await marketLink.waitFor();
  await marketLink.click();
  await page.waitForURL('**/explore');
  await page.goto(site+'/admin');
  results.push('Reviewer real login has campus-scoped navigation');
  await logout();

  await page.setViewportSize({width:1280,height:900});
  await loginAs('global-admin@stage1.invalid');
  await page.goto(site+'/admin');
  await page.getByRole('heading',{name:'University administration'}).waitFor();
  await page.getByRole('button',{name:'Content',exact:true}).click();
  const editorial=page.locator('.home-admin-editor');
  await editorial.getByRole('heading',{name:'Editorial content'}).waitFor();
  // Default homepage art is an illustration, not an unrelated student's photos.
  await editorial.getByText('Without one, the default marketplace illustration appears.',{exact:false}).waitFor();
  await editorial.getByRole('textbox',{name:'Headline start'}).fill('P1 Browser Verified Campus');
  await editorial.getByRole('button',{name:'Save text draft'}).click();
  await editorial.getByText('Unpublished draft changes').first().waitFor();
  const photos=editorial.locator('.home-admin-images');
  const publish=photos.getByRole('button',{name:'Publish saved draft'});
  const layout=await photos.evaluate(el=>{
    const grid=el.querySelector('.home-admin-image-grid');
    const actions=el.querySelector('.home-admin-publish-actions');
    return {within:!!actions,after:!!grid&&!!actions&&grid.compareDocumentPosition(actions)===Node.DOCUMENT_POSITION_FOLLOWING,status:!!el.querySelector('.home-admin-status')};
  });
  if (!layout.within||!layout.after||!layout.status) throw Error('Photo draft/publish workflow hierarchy broken: '+JSON.stringify(layout));
  // Use a repository-owned test icon; only synthetic users in the isolated DB see this image.
  const oldPublic=await (await page.request.get(site+'/api/v1/home-page')).json();
  await photos.locator('.home-admin-image').first().locator('input[type=file]').setInputFiles('C:/Users/acer/Downloads/cpsu-student-marketplace/apps/web/public/icons/icon-192.png');
  await photos.getByText('Saved to draft · publish to update student view').first().waitFor({timeout:12000});
  const beforePublish=await (await page.request.get(site+'/api/v1/home-page')).json();
  if(beforePublish.images.hero!==oldPublic.images.hero) throw Error('Draft image became public before Publish');
  await publish.click();
  await editorial.getByText('Homepage is live').first().waitFor();
  results.push('University admin real login saves draft photo + text and publishes through nearby controls');
  await logout();
  await page.goto(site+'/');
  await page.getByRole('heading',{name:/P1 Browser Verified Campus/}).waitFor();
  const heroSrc=await page.locator('.home-custom-hero img').getAttribute('src');
  if(!heroSrc?.includes('/api/v1/home-page/images/hero')) throw Error('Published hero image not reflected for guest: '+heroSrc);
  results.push('Guest sees newly published content and photo, without browser mocking');

  return results;
}
