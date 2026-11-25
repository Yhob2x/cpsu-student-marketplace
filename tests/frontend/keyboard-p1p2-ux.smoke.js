async page => {
  const base='http://127.0.0.1:5173';
  const results=[];
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    await page.goto(base+'/explore');
    const campus=page.locator('.explore-inline-filter-group').first();
    const more=page.getByRole('button',{name:'More campus options'});
    await more.waitFor({timeout:8000});
    await more.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('.explore-inline-filter-group .explore-inline-filter-options')?.scrollLeft>15);
    const chip=campus.locator('.explore-inline-filter-options button[aria-pressed]').nth(1);
    await chip.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/campusId=/);
    results.push(width+'px keyboard campus navigation changes URL and preserves direct filters');

    await page.goto(base+'/');
    const chat=page.locator('.floating-chat');
    await chat.waitFor({state:'visible'});
    const search=page.getByRole('textbox',{name:'Search listings'});
    await search.focus();
    if(await chat.isVisible()) throw Error('Chat overlaps a focused mobile search field at '+width+'px');
    await page.keyboard.press('Tab');
    await chat.waitFor({state:'visible'});
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))
      throw Error('Horizontal page overflow at '+width+'px');
    results.push(width+'px search focus hides chat; keyboard exit restores launcher without overflow');
  }
  return results;
}
