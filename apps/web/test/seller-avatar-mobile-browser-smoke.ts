/**
 * Opt-in real Chromium / mobile-width UI smoke of actual React SellerAvatarEditor.
 * A browser-only fetch stub denies all unlisted requests; no API writes, credentials,
 * uploads, personal records, or remote network data.
 *
 * Requires separate Vite dev server http://127.0.0.1:5198
 * bun test/seller-avatar-mobile-browser-smoke.ts --synthetic-browser-only
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if(process.argv.length!==3 || process.argv[2]!=='--synthetic-browser-only')
  throw new Error('Explicit synthetic-browser-only flag required');
const origin='http://127.0.0.1:5198';
const host=new URL(origin);
if(host.hostname!=='127.0.0.1')throw new Error('REFUSED: loopback only');
const check=await fetch(origin+'/test/fixtures/seller-avatar-mobile-qa.html');
if(!check.ok)throw new Error('Test fixture not served by local Vite');
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if(!existsSync(chrome))throw new Error('Chrome not installed');
let allPassed=true;
for(const width of [320,360,390]){
  const profile=mkdtempSync(join(tmpdir(),'cpsu-avatar-ui-'+width+'-'));
  try {
    const task=Bun.spawn([chrome,'--headless=new','--no-first-run',
      '--no-default-browser-check','--disable-background-networking',
      '--disable-extensions','--disable-sync','--disable-gpu','--no-sandbox',
      '--user-data-dir='+profile,'--force-device-scale-factor=1',
      '--window-size='+width+',844','--virtual-time-budget=16000','--dump-dom',
      origin+'/test/fixtures/seller-avatar-mobile-qa.html?width='+width,
    ],{stdout:'pipe',stderr:'pipe'});
    const [dom, errors]=await Promise.all([
      new Response(task.stdout).text(),
      new Response(task.stderr).text(),
    ]);
    const exit=await task.exited;
    const status=dom.match(/data-avatar-qa-result="([^"]+)"/)?.[1]??'NO_RESULT';
    const error=dom.match(/data-avatar-qa-error="([^"]+)"/)?.[1]??null;
    const checks=dom.match(/data-avatar-qa-checks="([^"]+)"/)?.[1]?.replaceAll('&quot;','"')??'[]';
    console.log(JSON.stringify({width,status,exit,checks:JSON.parse(checks),
      ...(status==='PASS'?{}:{error,chromeDiagnostic:errors.slice(-300)}),
      source:'actual React SellerAvatarEditor with browser-only fake HTTP'}));
    if(exit!==0 || status!=='PASS')allPassed=false;
  } finally {
    try { rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150}); }
    catch {console.log('Chrome temporary profile removal needs later cleanup.');}
  }
}
if(!allPassed)process.exitCode=1;
