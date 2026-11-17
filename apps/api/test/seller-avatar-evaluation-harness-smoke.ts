/**
 * No sensitive content. Exercises the offline evaluation runner with generated
 * harmless labeled images placed outside the repository and deleted afterward.
 * bun test/seller-avatar-evaluation-harness-smoke.ts --benign-corpus-only
 */
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
if(process.argv.length!==3 || process.argv[2]!=='--benign-corpus-only')
 throw new Error('REFUSED: expected --benign-corpus-only');
const base=process.env.LOCALAPPDATA;
if(!base || process.platform!=='win32')throw new Error('Windows local QA environment required');
const root=join(base,'CPSU-Marketplace','avatar-evaluation-benign-'+randomBytes(5).toString('hex'));
await mkdir(root,{recursive:true});
try {
 const items=[];
 for(const [i,color] of ['#ecebe4','#799980','#beccda'].entries()){
  const filename='synthetic-'+i+'.png';
  const bytes=await sharp({create:{width:512,height:512,channels:3,background:color}})
   .png().toBuffer();
  await writeFile(join(root,filename),bytes,{flag:'wx'});
  items.push({filename,label:'allowed'});
 }
 await writeFile(join(root,'manifest.json'),JSON.stringify({
  purpose:'consented-local-safety-evaluation',items,
 }),{flag:'wx'});
 const task=Bun.spawn([process.execPath,'scripts/seller-avatar-consented-evaluation.ts',
  '--evaluate-consented-local-images',root],{
    cwd:join(import.meta.dir,'..'),stdout:'pipe',stderr:'pipe',
 });
 const [stdout,stderr]=await Promise.all([
  new Response(task.stdout).text(),new Response(task.stderr).text(),
 ]);
 const exit=await task.exited;
 const record=stdout.trim().split(/\r?\n/).filter(Boolean).map(s=>{try{return JSON.parse(s)}catch{return null}})
  .find(x=>x?.suite==='OFFLINE_AUTHORIZED_AVATAR_EVALUATION');
 if(exit!==0 || !record || record.total!==3 || record.labels?.allowed!==3 ||
   record.labels?.prohibited!==0 || record.status!=='INCOMPLETE_LABEL_COVERAGE' ||
   record.technicalFailures!==0)
  throw new Error('Benign-only evaluation smoke failed: '+stderr.slice(-250));
 console.log(JSON.stringify({suite:'BENIGN_EVALUATION_HARNESS_SMOKE',result:'PASS',
  allSynthetic:true,prohibitedCorpusPresent:false,filesRemoved:true,
  classificationSummary:record.outcomesByLabel.allowed}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:150})}
