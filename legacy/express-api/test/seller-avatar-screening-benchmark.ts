/**
 * Opt-in, CPU-only, data-free screening capacity preflight.
 * Builds abstract images locally. Does NOT evaluate real explicit-content accuracy.
 * bun test/seller-avatar-screening-benchmark.ts --synthetic-benchmark
 */
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import sharp from 'sharp';

if (process.argv.length !== 3 || process.argv[2] !== '--synthetic-benchmark')
  throw new Error('Explicit --synthetic-benchmark flag required');
const dir = await mkdtemp(join(tmpdir(), 'cpsu-nsfw-capacity-'));
process.env.MEDIA_STORAGE = 'local';
process.env.UPLOAD_DIR = dir;
process.env.NODE_ENV = 'test';
const { screenSellerAvatar } = await import('../src/seller-avatar-screening.js');
const samples = [
  { name: 'ivory', color: '#f5f4ec' }, { name: 'sage', color: '#829b77' },
  { name: 'terracotta', color: '#d4a58a' }, { name: 'sky', color: '#7da4c6' },
  { name: 'navy', color: '#293b54' }, { name: 'yellow', color: '#e9dc8b' },
  { name: 'lavender', color: '#b4a9ce' }, { name: 'gray', color: '#949da3' },
];
const results: Array<{category:string;ms:number;result:string}> = [];
const memoryBefore = process.memoryUsage();
let firstError = '';
try {
  // Generated image bytes contain no student content and are never submitted to Drive.
  const input: Array<{name:string;path:string}> = [];
  for (let i=0; i<samples.length; i++) {
    const sample=samples[i];
    const fileName=(i.toString(16).repeat(32)).slice(0,32)+'.webp';
    const filePath=join(dir,fileName);
    const center = Buffer.from('<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><circle cx="256" cy="256" r="90" fill="#ffffff" opacity=".65"/><rect x="205" y="220" width="100" height="70" rx="12" fill="#303b48" opacity=".6"/></svg>');
    const bytes=await sharp({create:{width:512,height:512,channels:3,background:sample.color}})
      .composite([{input:center}]).webp({quality:82}).toBuffer();
    await writeFile(filePath,bytes,{flag:'wx'});
    input.push({name:sample.name,path:fileName});
  }
  for(const sample of input) {
    const start=performance.now();
    let result='safe';
    try { await screenSellerAvatar(sample.path); }
    catch(e) {
      const error = e as {code?:string;status?:number};
      result = error.code ?? 'unknown_error';
      if (!error.status || !['avatar_uncertain_content','avatar_explicit_content'].includes(result))
        firstError=firstError || result;
    }
    results.push({category:sample.name,ms:Math.round(performance.now()-start),result});
  }
  const ms=results.map(r=>r.ms);
  const sorted=[...ms].sort((a,b)=>a-b);
  const total=ms.reduce((a,b)=>a+b,0);
  const rss=process.memoryUsage().rss;
  console.log(JSON.stringify({
    suite:'SELLER_AVATAR_LOCAL_CPU_BENCHMARK',mode:'synthetic only',
    samples:results.length,p50WarmMs:sorted[Math.floor((sorted.length-1)*0.5)],
    p95WithColdStartMs:sorted[Math.ceil(sorted.length*0.95)-1],
    coldStartFirstMs:results[0].ms,
    meanMs:Math.round(total/results.length),
    currentRssMiB:Math.round(rss/1048576),
    rssIncreaseMiB:Math.round((rss-memoryBefore.rss)/1048576),
    decisions:Object.fromEntries([...new Set(results.map(r=>r.result))].map(k=>[k,results.filter(r=>r.result===k).length])),
    individual:results.map(x=>({sample:x.category,status:x.result,ms:x.ms})),
    unexpectedError:firstError || null,
    noNetworkImageApi:true,productionServerBenchmark:false,
  }));
  if(firstError) process.exitCode=1;
} finally {
  await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:150});
}
