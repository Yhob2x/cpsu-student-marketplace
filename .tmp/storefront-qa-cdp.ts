// Local-only visual QA; opens a disposable headless Chrome profile and takes viewport screenshots.
const chrome = Bun.spawn([
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-allow-origins=*', '--remote-debugging-port=9225',
  '--user-data-dir=C:\\Users\\acer\\Downloads\\cpsu-student-marketplace\\.tmp\\cdp-storefront-qa',
  'about:blank',
], { stdout:'ignore', stderr:'ignore' });
try {
  let pages;
  for (let trial=0;trial<35;trial++) {
    try { pages=await (await fetch('http://127.0.0.1:9225/json')).json(); if (pages?.find(p=>p.type==='page')) break; } catch {}
    await Bun.sleep(170);
  }
  const target=pages?.find(p=>p.type==='page');
  if(!target) throw new Error('No Chrome page debugger');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map(); let seq=0;
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);
      if(msg.error)reject(new Error(JSON.stringify(msg.error)));else resolve(msg.result);}
  };
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send('Page.enable');
  await send('Runtime.enable');
  const base='C:\\Users\\acer\\Downloads\\cpsu-student-marketplace\\.tmp';
  for(const width of [320,360,390,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<=390});
    await send('Page.navigate',{url:'http://127.0.0.1:5199/test/fixtures/storefront-layout-qa.html'});
    await Bun.sleep(1600);
    const m=await send('Runtime.evaluate',{expression:`JSON.stringify({width:innerWidth, docWidth:document.documentElement.scrollWidth, bodyWidth:document.body.scrollWidth, container:document.querySelector('.storefront')?.getBoundingClientRect().width, actions:document.querySelector('.storefront-owner-actions')?.getBoundingClientRect().width, columns:getComputedStyle(document.querySelector('.storefront-listings')).gridTemplateColumns, cards:document.querySelectorAll('.storefront-listings > *').length})`,returnByValue:true});
    console.log(width,m.result?.value);
    const snap=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await Bun.write(base+'\\storefront-cdp-'+width+'.png',Buffer.from(snap.data,'base64'));
  }
  ws.close();
} finally { chrome.kill(); }
