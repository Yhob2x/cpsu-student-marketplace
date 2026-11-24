async page => {
  const results = [];
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('http://localhost:5173/');
    await page.locator('.floating-chat').waitFor({ state: 'visible' });
    const result = await page.evaluate(() => {
      const box = element => element.getBoundingClientRect();
      const chat = document.querySelector('.floating-chat');
      const tabs = document.querySelector('.tabbar');
      if (!chat || !tabs) throw new Error('Missing floating chat or bottom nav');
      const c = box(chat), n = box(tabs);
      const intersect = (a,b) => Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)) * Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      const obstructed = [...document.querySelectorAll('main a, main button, main input, main select, main textarea')]
        .filter(el => {const r=box(el);return r.bottom<=n.top+1 && r.top>=0 && r.right>0 && r.left<innerWidth && intersect(c,r)>0;})
        .map(el => el.getAttribute('aria-label') || (el.textContent||'').trim().slice(0,50));
      const tabOverlaps = [...tabs.querySelectorAll('a')].filter(el => intersect(c,box(el))>0).map(el => (el.textContent||'').trim());
      return {width:innerWidth, launcherAboveTabs:c.bottom <= n.top-6, launcherBox:{top:c.top,bottom:c.bottom,left:c.left,right:c.right},tabTop:n.top,obstructed,tabOverlaps,overflow:document.documentElement.scrollWidth>innerWidth+1,tooSmall:c.width<44 || c.height<44};
    });
    results.push(result);
    if (!result.launcherAboveTabs || result.obstructed.length || result.tabOverlaps.length || result.overflow || result.tooSmall) {
      throw new Error('Mobile chat layout failure: '+JSON.stringify(result));
    }
  }
  return results;
}
