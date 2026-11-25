async page => {
  const results=[];
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('.floating-chat').waitFor({timeout:12000});
    const cat=page.locator('.category-section .category-head a');
    await cat.waitFor();
    await cat.scrollIntoViewIfNeeded();
    const r=await page.evaluate(()=>{
      const chat=document.querySelector('.floating-chat');
      const link=document.querySelector('.category-section .category-head a');
      const bar=document.querySelector('.tabbar');
      if(!chat||!link||!bar) return null;
      const a=chat.getBoundingClientRect(), b=link.getBoundingClientRect(), nav=bar.getBoundingClientRect();
      const area=(x,y)=>Math.max(0,Math.min(x.right,y.right)-Math.max(x.left,y.left))*Math.max(0,Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
      return {chat:[a.x,a.y,a.width,a.height],viewAll:[b.x,b.y,b.width,b.height],chatOverlapsAction:area(a,b)>0,chatWithinDock:a.top>=nav.top-3,navTop:nav.top,documentOverflows:document.documentElement.scrollWidth>innerWidth+1};
    });
    results.push({width,geometry:r});
    if(r?.chatOverlapsAction||!r?.chatWithinDock||r?.documentOverflows) throw Error('Chat collision / overflow '+JSON.stringify(r));
    await cat.click();
    await page.waitForURL('**/explore');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5173/explore');
  await page.locator('.explore-inline-filter-group').first().waitFor();
  const campus=page.getByRole('button',{name:'More campus options'});
  await campus.waitFor({timeout:1500});
  const before=await page.locator('.explore-inline-filter-group').first().locator('.explore-inline-filter-options').evaluate(el=>el.scrollLeft);
  await campus.click();
  await page.waitForFunction(() => (document.querySelector('.explore-inline-filter-group .explore-inline-filter-options')?.scrollLeft ?? 0) > 45, {timeout:4000});
  const after=await page.locator('.explore-inline-filter-group').first().locator('.explore-inline-filter-options').evaluate(el=>el.scrollLeft);
  if(after<=before) throw Error('Campus filter scroll control did not move rail');
  results.push({campusCue:true,from:before,to:after});
  const category=page.getByRole('button',{name:'More category options'});
  await category.waitFor({timeout:4000});
  await category.click();
  await page.waitForFunction(() => (document.querySelectorAll('.explore-inline-filter-group .explore-inline-filter-options')[1]?.scrollLeft ?? 0)>45,{timeout:4000});
  await page.locator('.explore-inline-filter-group').nth(1).locator('button[aria-pressed]').last().click();
  await page.waitForURL(/categoryId=/);
  results.push({categoryCue:true,selectedFilterKeptInUrl:true});
  return results;
}