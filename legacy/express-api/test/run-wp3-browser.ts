/**
 * WP3 Gate C isolated automated Chrome desktop/mobile browser acceptance.
 *
 * Run from apps/api: bun test/run-wp3-browser.ts --isolated-browser-acceptance
 *
 * Creates synthetic fixtures only in existing EMPTY cpsu_marketplace_test.
 * NEVER connects the test web app to localhost:4000 or dev student records.
 * Creates temporary local-only API (:4195) + static web (:5195) servers,
 * plus two ephemeral independent Chrome user profiles; cleans up both and
 * synthetic DB fixtures on exit. No package installation or service deployment.
 */
import { PrismaClient } from '@prisma/client';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import type { Server } from 'node:http';

const assert = (value: unknown, label: string): asserts value => {
  if (!value) throw new Error('GATE C BROWSER FAIL: ' + label);
};
if (process.argv.length !== 3 || process.argv[2] !== '--isolated-browser-acceptance')
  throw new Error('Explicit --isolated-browser-acceptance required; no other modes.');
const initial = process.env.DATABASE_URL ?? '';
let source: URL;
try { source = new URL(initial); } catch { throw new Error('Missing local development DB URL.'); }
if (process.env.NODE_ENV === 'production' || source.protocol !== 'mysql:' ||
    source.hostname !== '127.0.0.1' || source.port !== '3306' ||
    source.pathname !== '/cpsu_marketplace' || source.search || source.hash)
  throw new Error('Only local 127.0.0.1:3306/cpsu_marketplace source identity allowed.');

const testUrl = new URL(initial);
testUrl.pathname = '/cpsu_marketplace_test';
const temp = mkdtempSync(join(tmpdir(), 'cpsu-wp3-browser-'));
const testUpload = join(temp, 'cpsu-marketplace-stage1-test-uploads');
process.env.DATABASE_URL = testUrl.toString();
process.env.NODE_ENV = 'test';
process.env.CPSU_INTEGRATION_TESTS = '1';
process.env.UPLOAD_DIR = testUpload;
process.env.PORT = '4195';
process.env.BIND_HOST = '127.0.0.1';
process.env.CORS_ORIGINS = 'http://127.0.0.1:5195';
process.env.COOKIE_SECURE = 'false';
process.env.PUSH_SUBSCRIPTIONS_ENABLED = 'false';
process.env.PUSH_DELIVERY_ENABLED = 'false';

const db = new PrismaClient({ datasources: { db: { url: testUrl.toString() } } });
type Chrome = { command: (method: string, args?: Record<string, unknown>) => Promise<any>;
  eval: (expr: string) => Promise<any>; close: () => void; };
const browsers: Chrome[] = [];
const children: { kill: () => void }[] = [];
let apiServer: Server | undefined;
let webServer: ReturnType<typeof Bun.serve> | undefined;
let seeded = false;
let result = 'STOPPED';
const checks: string[] = [];

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
function ok(label: string, condition: unknown) {
  assert(condition, label);
  checks.push(label);
  console.log('PASS '+label);
}
async function ensureIsolatedEmpty() {
  const identity = await db.$queryRawUnsafe<{name:string}[]>('SELECT DATABASE() AS name');
  assert(identity[0]?.name === 'cpsu_marketplace_test','test DB identity mismatch');
  const active = await db.$queryRawUnsafe<{n:bigint}[]>(
    "SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE DB='cpsu_marketplace_test' AND ID<>CONNECTION_ID()");
  assert(Number(active[0]?.n??0)===0,'other active test DB connection detected');
  const tables = await db.$queryRawUnsafe<{name:string}[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  assert(tables.length === 26, 'test-only schema must have existing approved 26-table baseline');
  for(const table of tables) {
    if(table.name.toLowerCase()==='_prisma_migrations')continue;
    assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(table.name), 'unexpected test table identifier');
    const count=await db.$queryRawUnsafe<{n:bigint}[]>(
      'SELECT COUNT(*) AS n FROM `'+table.name+'`');
    assert(Number(count[0]?.n??0)===0, 'test schema contains data; refusing fixture creation');
  }
  const migration = await db.$queryRawUnsafe<{n:bigint}[]>(
    "SELECT COUNT(*) AS n FROM `_prisma_migrations` WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL");
  assert(Number(migration[0]?.n??0)===8, 'test schema migration baseline incomplete');
  console.log('GATE C TEST TARGET: exact local isolated test schema, all 26 tables empty, 8 applied test migrations, no other DB sessions.');
}

function launchChrome(port: number, mobile: boolean): Promise<Chrome> {
  return (async()=>{
    const executable='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    assert(existsSync(executable),'Chrome binary not installed');
    // Each launch uses a previously nonexistent profile under our own temp root.
    const profile=join(temp,mobile?'mobile-chrome':'desktop-chrome');
    const proc=Bun.spawn([executable, '--headless=new', '--no-first-run',
      '--no-default-browser-check', '--disable-background-networking', '--disable-extensions',
      '--disable-sync', '--disable-gpu', '--remote-allow-origins=*',
      '--remote-debugging-port='+port, '--user-data-dir='+profile,
      '--window-size='+(mobile?'390,844':'1440,900'), 'about:blank'],
      {stdout:'ignore',stderr:'ignore'});
    children.push(proc);
    let targets:any[]= [];
    let ready=false;
    for(let attempt=0;attempt<40;attempt++) {
      await sleep(150);
      try {
        const resp=await fetch('http://127.0.0.1:'+port+'/json');
        if(resp.ok) {
          targets=await resp.json() as any[];
          if(targets.some(t=>t.type==='page')) {ready=true;break;}
        }
      }catch{ /* Browser starting. */ }
    }
    assert(ready, 'Chrome CDP did not start on expected private port '+port);
    const target=targets.find(t=>t.type==='page');
    const ws=new WebSocket(target.webSocketDebuggerUrl);
    let seq=0;
    const inflight=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
    await new Promise<void>((yes,no)=>{
      const timer=setTimeout(()=>no(new Error('Chrome CDP connect timeout')),5000);
      ws.addEventListener('open',()=>{clearTimeout(timer);yes()},{once:true});
      ws.addEventListener('error',()=>{clearTimeout(timer);no(new Error('CDP socket failed'))},{once:true});
    });
    ws.addEventListener('message',(event)=>{
      let msg:any;
      try {msg=JSON.parse(String(event.data));}catch{return;}
      if(typeof msg.id !== 'number')return;
      const waiting=inflight.get(msg.id);
      if(!waiting)return;
      inflight.delete(msg.id);
      if(msg.error)waiting.reject(new Error(msg.error.message));
      else waiting.resolve(msg.result??{});
    });
    const command=(method:string,params:Record<string,unknown>={})=>{
      const id=++seq;
      return new Promise<any>((resolve,reject)=>{
        const timeout=setTimeout(()=>{inflight.delete(id);reject(new Error('CDP '+method+' timeout'));},15000);
        inflight.set(id,{
          resolve:v=>{clearTimeout(timeout);resolve(v);},
          reject:e=>{clearTimeout(timeout);reject(e);},
        });
        ws.send(JSON.stringify({id,method,params}));
      });
    };
    const evaluate=async (expression:string)=>{
      const raw=await command('Runtime.evaluate',{
        expression,returnByValue:true,awaitPromise:true,userGesture:true,
      });
      if(raw.exceptionDetails) throw new Error('Browser JavaScript error: '+
        (raw.exceptionDetails.text??'Runtime.evaluate failed'));
      return raw.result?.value;
    };
    const chrome:Chrome={
      command,
      eval:evaluate,
      close:()=>{try{ws.close();}catch{}try{proc.kill();}catch{}},
    };
    browsers.push(chrome);
    await command('Page.enable');
    await command('Runtime.enable');
    if(mobile){
      await command('Emulation.setDeviceMetricsOverride',{
        width:390,height:844,deviceScaleFactor:3,mobile:true,
      });
      await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    } else {
      await command('Emulation.setDeviceMetricsOverride',{
        width:1440,height:900,deviceScaleFactor:1,mobile:false,
      });
    }
    return chrome;
  })();
}
async function goto(browser:Chrome, path:string) {
  await browser.command('Page.navigate',{url:'http://127.0.0.1:5195'+path});
  await browser.eval('new Promise(resolve => { if(document.readyState === "complete") resolve(true); else window.addEventListener("load",()=>resolve(true),{once:true}); setTimeout(()=>resolve(true),2500); })');
}
async function wait(browser:Chrome, jsCondition:string, label:string, timeout=9000) {
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
    try{if(await browser.eval('Boolean((()=>('+jsCondition+'))())'))return;}catch{}
    await sleep(175);
  }
  const diagnostic=String(await browser.eval('document.body?.innerText?.slice(0,400)??""')).replaceAll(/\s+/g,' ');
  throw new Error('Browser wait failure: '+label+'; page='+diagnostic);
}
async function click(browser:Chrome, label:string) {
  const selectors=JSON.stringify(label);
  const okValue=await browser.eval('(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent?.trim() === '+selectors+');if(!b || b.disabled)return false;b.click();return true})()');
  ok('button active: '+label,okValue);
}
async function signIn(browser:Chrome,email:string) {
  await goto(browser,'/login');
  await wait(browser,'!!document.querySelector("form.auth-form input[name=email]")','sign in form');
  const login=await browser.eval('(()=>{const f=document.querySelector("form.auth-form");if(!f)return false;f.elements.namedItem("email").value='+JSON.stringify(email)+';f.elements.namedItem("password").value="TestPassphrase-Stage1-2026!";f.requestSubmit();return true})()');
  ok('submitted login form',login);
  await wait(browser,'!document.querySelector("form.auth-form")','login form dismissed');
  // Header links exist for guests too; confirm sign-out control is rendered.
  await wait(browser,'[...document.querySelectorAll("button")].some(b=>b.textContent?.trim()==="Sign out")','signed-in account header');
}
async function viewport(browser:Chrome, name:string) {
  const geometry=await browser.eval('(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll("button")].filter(x=>!x.disabled).length}))()');
  ok(name+' viewport has controls', geometry?.buttons>0);
  const noOverflow=geometry?.scroll<=geometry?.width+3;
  if(!noOverflow)console.log('UX FINDING '+name+' horizontal overflow: viewport='+geometry.width+' document='+geometry.scroll);
  else checks.push(name+' has no document-wide horizontal overflow');
  return geometry;
}

/** Browser-only narrow mobile viewports and semantic checks; no database writes. */
async function auditNarrowTransaction(browser:Chrome, widths:number[], stage:string) {
  for(const width of widths){
    await browser.command('Emulation.setDeviceMetricsOverride',{
      width,height:667,deviceScaleFactor:3,mobile:true,
    });
    await sleep(140);
    const m=await browser.eval('(()=>{const visible=e=>{const s=getComputedStyle(e);const r=e.getBoundingClientRect();return s.display!=="none" && s.visibility!=="hidden" && r.width>0 && r.height>0;};const actions=[...document.querySelectorAll("main button")].filter(visible).map(e=>({text:(e.textContent??"").trim(),w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height),disabled:e.disabled}));const fields=[...document.querySelectorAll("main input,main textarea,main select")].filter(visible).map(e=>({type:e.tagName,id:e.id,labels:e.labels?.length??0}));return {width:innerWidth,scroll:document.documentElement.scrollWidth,heading:!!document.querySelector("main h1"),main:!!document.querySelector("main"),actions,fields}})()');
    ok(stage+' at '+width+'px has visible heading and main landmark',m?.heading&&m?.main);
    ok(stage+' at '+width+'px has no horizontal overflow',m.scroll<=m.width+3);
    ok(stage+' at '+width+'px cancellation field has visible accessible label',
      m.fields.some((f:{id:string;labels:number})=>f.id==='transaction-cancellation-reason'&&f.labels>0));
    const small=m.actions.filter((a:{w:number;h:number;disabled:boolean})=>!a.disabled&&(a.h<44 || a.w<44));
    ok(stage+' at '+width+'px active buttons meet 44px touch target guidance',small.length===0);
  }
  await browser.command('Emulation.setDeviceMetricsOverride',{
    width:390,height:844,deviceScaleFactor:3,mobile:true,
  });
  await sleep(140);
}

async function syntheticScreenshot(browser:Chrome,filename:string) {
  const project=resolve(import.meta.dir,'../../..');
  const out=join(project,'docs','wp3-browser-evidence');
  mkdirSync(out,{recursive:true});
  const capture=await browser.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  assert(typeof capture?.data==='string' && capture.data.length>1000,'synthetic screenshot missing');
  writeFileSync(join(out,filename),Buffer.from(capture.data,'base64'));
  console.log('SYNTHETIC_SCREENSHOT '+join('docs','wp3-browser-evidence',filename));
}

try {
  await ensureIsolatedEmpty();
  const {resetFixtures,seedFixtures}=await import('./integration/fixtures.js');
  const {hashPassword}=await import('../src/auth.js');
  const fx=await seedFixtures(db,hashPassword);
  seeded=true;
  ok('synthetic fixtures seeded only into local test schema',!!fx.published?.id);
  // Launch test-only API after process.env has switched to the exact test URL.
  const {createApp}=await import('../src/app.js');
  apiServer=createApp().listen(4195,'127.0.0.1');
  const dist=resolve(import.meta.dir,'../../web/dist');
  assert(existsSync(join(dist,'index.html')),'static web build missing: run bun run build in apps/web');
  webServer=Bun.serve({
    hostname:'127.0.0.1',port:5195,
    async fetch(req) {
      const u=new URL(req.url);
      if(u.pathname.startsWith('/api/')){
        const headers=new Headers(req.headers);headers.delete('host');
        return fetch('http://127.0.0.1:4195'+u.pathname+u.search,{
          method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body,
          redirect:'manual',
        });
      }
      const file=resolve(dist,'.'+(u.pathname==='/'
        ?'/index.html':u.pathname));
      if(file.startsWith(dist+sep) && existsSync(file))
        return new Response(Bun.file(file),{headers:{'Cache-Control':'no-store'}});
      return new Response(Bun.file(join(dist,'index.html')),{
        headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},
      });
    },
  });
  // Browser cannot access the existing dev API; only our isolated loopback proxy.
  const health=await fetch('http://127.0.0.1:5195/api/v1/campuses');
  ok('private browser app proxies only to isolated test API',health.ok);
  const buyer=await launchChrome(9345,true);
  const seller=await launchChrome(9346,false);
  await signIn(buyer,'buyer@stage1.invalid');
  await signIn(seller,'seller@stage1.invalid');

  await goto(buyer,'/listings/'+fx.published.id);
  await wait(buyer,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Request item")','buyer listing request button');
  await viewport(buyer,'mobile listing');
  await click(buyer,'Request item');
  await wait(buyer,'/^\\/transactions\\/\\d+$/.test(location.pathname)','buyer request redirect');
  const transactionUrl=String(await buyer.eval('location.pathname'));
  const txId=Number(transactionUrl.split('/').at(-1));
  ok('buyer redirected to own new pending transaction', txId>0);
  await wait(buyer,'document.body.innerText.includes("Pending seller decision")','pending state shown');
  await viewport(buyer,'mobile pending transaction');
  const nextActionTop=await buyer.eval('([...document.querySelectorAll("section")].find(e=>e.getAttribute("aria-label")==="Update this transaction"))?.getBoundingClientRect().top');
  const secondaryLinksTop=await buyer.eval('([...document.querySelectorAll("a")].find(e=>e.textContent?.trim()==="Discuss arrangements"))?.getBoundingClientRect().top');
  ok('next action appears before secondary links on mobile',typeof nextActionTop==='number'&&typeof secondaryLinksTop==='number'&&nextActionTop<secondaryLinksTop);
  ok('next action starts in the first mobile viewport',typeof nextActionTop==='number'&&nextActionTop<580);
  await auditNarrowTransaction(buyer,[320,375,390],'buyer pending transaction');
  await syntheticScreenshot(buyer,'buyer-pending-mobile-390.png');
  await goto(seller,transactionUrl);
  await wait(seller,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Accept request")','seller decision control');
  await viewport(seller,'desktop seller decision');
  await syntheticScreenshot(seller,'seller-decision-desktop-1440.png');
  ok('seller Accept request is keyboard-focusable',await seller.eval('(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent?.trim()==="Accept request");return !!b&&b.tabIndex>=0&&getComputedStyle(b).visibility!=="hidden"})()'));
  await seller.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
  await sleep(150);
  const sellerMobileButton=await seller.eval('(()=>{const b=[...document.querySelectorAll("button")].find(e=>e.textContent?.trim()==="Accept request");if(!b)return null;const r=b.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,scroll:document.documentElement.scrollWidth,width:innerWidth}})()');
  ok('mobile seller action does not overflow horizontally',sellerMobileButton&&sellerMobileButton.scroll<=sellerMobileButton.width+3);
  if(sellerMobileButton?.bottom >= sellerMobileButton?.height-80)
    console.log('UX REVIEW seller 390px: Accept request may require scrolling; top='+sellerMobileButton.top);
  await seller.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await sleep(120);
  await click(seller,'Accept request');
  await wait(seller,'document.body.innerText.includes("Accepted")','seller accepted status');
  const reserved=await db.listing.findUniqueOrThrow({where:{id:fx.published.id}});
  ok('seller acceptance exclusively reserved physical item',
    reserved.availabilityState==='reserved' && reserved.reservationTransactionId===txId);

  await goto(buyer,transactionUrl);
  await wait(buyer,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Confirm meetup arrangement")','buyer meetup control');
  await click(buyer,'Confirm meetup arrangement');
  await wait(buyer,'document.body.innerText.includes("Waiting for the other student")','first meetup confirmation did not advance');
  ok('first meetup confirmation remains accepted', (await db.transaction.findUniqueOrThrow({where:{id:txId}})).status==='accepted');

  await goto(seller,transactionUrl);
  await wait(seller,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Confirm meetup arrangement")','seller meetup control');
  await click(seller,'Confirm meetup arrangement');
  await wait(seller,'document.body.innerText.includes("Meetup agreed")','both meetup confirmations reached for_meetup');
  await goto(seller,transactionUrl);
  await wait(seller,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Confirm transaction completed")','seller complete control');
  await click(seller,'Confirm transaction completed');
  await wait(seller,'document.body.innerText.includes("Waiting for the other student")','seller first completion waits');
  ok('first completion confirmation does not mark sold', (await db.listing.findUniqueOrThrow({where:{id:fx.published.id}})).availabilityState==='reserved');

  await goto(buyer,transactionUrl);
  await wait(buyer,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Confirm transaction completed")','buyer completion control');
  await click(buyer,'Confirm transaction completed');
  await wait(buyer,'document.body.innerText.includes("Completed")','mutual completion shown');
  const after=await db.listing.findUniqueOrThrow({where:{id:fx.published.id}});
  ok('mutual completion marks physical item sold',after.availabilityState==='sold');
  ok('transaction activity history includes both meetup and completion signatures',
    (await db.transactionStatusLog.count({where:{transactionId:txId,event:'meetup_confirmed'}}))===2 &&
    (await db.transactionStatusLog.count({where:{transactionId:txId,event:'completion_confirmed'}}))===2);
  await viewport(buyer,'mobile completed transaction');
  await syntheticScreenshot(buyer,'buyer-completed-mobile-390.png');
  await goto(buyer,transactionUrl);
  await wait(buyer,'document.body.innerText.includes("Both students confirmed completion")','completed status survives refresh');

  const cancellationListing=await db.listing.create({data:{
    type:'physical_product',sellerProfileId:fx.store.id,campusId:fx.campusA.id,
    categoryId:fx.category.id,title:'Gate C Cancel Test Item',description:'Synthetic UI cancellation test only.',
    price:210,status:'published',
  }});
  await goto(buyer,'/listings/'+cancellationListing.id);
  await wait(buyer,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Request item")','cancel path request button');
  await click(buyer,'Request item');
  await wait(buyer,'/^\\/transactions\\/\\d+$/.test(location.pathname)','cancel path new transaction');
  const cancelUrl=String(await buyer.eval('location.pathname'));
  await goto(seller,cancelUrl);
  await wait(seller,'[...document.querySelectorAll("button")].some(x=>x.textContent?.trim()==="Accept request")','seller accept second request');
  await click(seller,'Accept request');
  await wait(seller,'document.body.innerText.includes("Accepted")','second request accepted');
  await goto(buyer,cancelUrl);
  await wait(buyer,'!!document.querySelector("#transaction-cancellation-reason")','cancellation reason input');
  ok('cancellation is disabled without a 10-character reason',await buyer.eval('(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent?.trim()==="Cancel transaction");return !!b&&b.disabled})()'));
  const textarea=await buyer.eval('(()=>{const x=document.querySelector("#transaction-cancellation-reason");if(!x)return false;const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set;setter.call(x,"I can no longer meet at the agreed campus time");x.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
  ok('buyer entered cancellation reason',textarea);
  await wait(buyer,'[...document.querySelectorAll("button")].some(b=>b.textContent?.trim()==="Cancel transaction"&&!b.disabled)','reason enables cancellation');
  await click(buyer,'Cancel transaction');
  await wait(buyer,'document.body.innerText.includes("Cancelled")','cancelled status shown');
  ok('cancelled transaction released only its own reservation',
    (await db.listing.findUniqueOrThrow({where:{id:cancellationListing.id}})).availabilityState==='available');
  const {signAccess}=await import('../src/auth.js');
  const outsider=await fetch('http://127.0.0.1:4195/api/v1/transactions/'+txId,{
    headers:{Authorization:'Bearer '+signAccess(fx.outsider.id)},
  });
  ok('unrelated student cannot read private completed transaction',outsider.status===404);

  result='PASS';
  console.log('WP3 GATE C BROWSER ACCEPTANCE PASS: desktop + mobile-width Chrome sessions, '+checks.length+' checkpoints, all synthetic.');
} catch(error){
  console.error('WP3 GATE C BROWSER STOP: '+(error instanceof Error?error.message:'unknown'));
  process.exitCode=1;
} finally {
  for(const browser of browsers){try{browser.close();}catch{}}
  if(webServer){try{webServer.stop(true);}catch{}}
  if(apiServer)await new Promise<void>(r=>{apiServer!.close(()=>r());setTimeout(r,1800);});
  for(const child of children){try{child.kill();}catch{}}
  if(seeded){
    try{
      const {resetFixtures}=await import('./integration/fixtures.js');
      await resetFixtures(db);
      console.log('TEST FIXTURE CLEANUP PASS: all browser synthetic records removed from cpsu_marketplace_test.');
    }catch(e){
      console.error('FIXTURE CLEANUP FAILED: manual inspection required; do not run another fixture reset blindly.');
      process.exitCode=1;
    }
  }
  await db.$disconnect();
  // Chrome may take a moment to release profile files; retain no private profiles.
  for(let i=0;i<6;i++){try{rmSync(temp,{recursive:true,force:true,maxRetries:1});break;}catch{await sleep(250);}}
  console.log('RESULT='+result+'; local development/prod records untouched; no network push, Git action or deployment.');
}
