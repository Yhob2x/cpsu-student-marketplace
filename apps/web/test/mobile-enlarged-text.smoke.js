async page => {
  const results = [];
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({width,height:844});
    await page.goto('http://localhost:5173/');
    await page.locator('.floating-chat').waitFor({state:'visible'});
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const check = await page.evaluate(() => {
      const chat = document.querySelector('.floating-chat').getBoundingClientRect();
      const tabbar = document.querySelector('.tabbar').getBoundingClientRect();
      const overlaps = [...document.querySelectorAll('.tabbar a')]
        .filter(el => {
          const r=el.getBoundingClientRect();
          return Math.max(0,Math.min(r.right,chat.right)-Math.max(r.left,chat.left))>0 &&
                 Math.max(0,Math.min(r.bottom,chat.bottom)-Math.max(r.top,chat.top))>0;
        }).map(el => el.textContent.trim());
      return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,
        chatOutsideTabbar:chat.top<tabbar.top-1 || chat.bottom>tabbar.bottom+1,
        overlaps,tabbarHeight:tabbar.height};
    });
    if (check.overflow || check.chatOutsideTabbar || check.overlaps.length) {
      throw new Error('Enlarged-text mobile nav failed: '+JSON.stringify(check));
    }
    results.push(check);
  }
  return results;
}
