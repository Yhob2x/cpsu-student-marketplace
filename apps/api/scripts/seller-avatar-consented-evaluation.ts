/**
 * Opt-in offline image-content evaluation. Strictly NOT a scraper or upload service.
 * Expects a local, owner-authorized corpus outside the CPSU repository and a
 * manifest labeling permitted test images as allowed or prohibited.
 * Raw paths, image content and per-item results are never printed/stored.
 *
 * bun scripts/seller-avatar-consented-evaluation.ts --evaluate-consented-local-images C:\\private\\avatar-evaluation
 *
 * manifest.json:
 * {"purpose":"consented-local-safety-evaluation","items":[
 *    {"filename":"photo1.jpg","label":"allowed"},
 *    {"filename":"photo2.png","label":"prohibited"}
 * ]}
 *
 * The evaluator does not imply images have been authorized merely because
 * this script exists. Do not use real students' images without authorization.
 */
import { mkdtemp, readFile, readdir, rm, lstat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, isAbsolute, sep } from 'node:path';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';

const command=process.argv;
if(command.length!==4 || command[2]!=='--evaluate-consented-local-images')
  throw new Error('REFUSED: explicit --evaluate-consented-local-images <absolute-directory> required');
const corpusArg=command[3];
if(!isAbsolute(corpusArg))throw new Error('REFUSED: require an absolute authorized local corpus directory');
const corpus=resolve(corpusArg);
const repo=resolve(import.meta.dir,'../../..');
if(corpus===repo || corpus.startsWith(repo+sep) || corpus.startsWith(resolve(tmpdir())+sep))
  throw new Error('REFUSED: corpus must be an authorized, independent local directory outside repository and temp');
const stat=await lstat(corpus);
if(!stat.isDirectory() || stat.isSymbolicLink())throw new Error('REFUSED: corpus must be a non-symlink local directory');
const manifestPath=join(corpus,'manifest.json');
const manifestStat=await lstat(manifestPath);
if(!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size>128*1024)
  throw new Error('REFUSED: invalid manifest');
type Label='allowed'|'prohibited';
type Item={filename:string;label:Label};
type Manifest={purpose:string;items:Item[]};
const manifest=JSON.parse(await readFile(manifestPath,'utf8')) as Manifest;
if(manifest.purpose!=='consented-local-safety-evaluation' || !Array.isArray(manifest.items) ||
    manifest.items.length===0 || manifest.items.length>100)
 throw new Error('REFUSED: manifest purpose, item count or authorization marker invalid');
const seen=new Set<string>();
for(const item of manifest.items) {
 if(!item || !['allowed','prohibited'].includes(item.label) ||
    typeof item.filename!=='string' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}\.(jpg|jpeg|png|webp)$/i.test(item.filename) ||
    item.filename.includes('..') || seen.has(item.filename.toLowerCase()))
  throw new Error('REFUSED: invalid label, duplicate or unsafe filename');
 seen.add(item.filename.toLowerCase());
 const file=await lstat(join(corpus,item.filename));
 if(!file.isFile() || file.isSymbolicLink() || file.size===0 || file.size>3*1024*1024)
  throw new Error('REFUSED: image is unavailable, symlinked, empty or too large');
}

const directory=await mkdtemp(join(tmpdir(),'cpsu-avatar-evaluation-'));
process.env.NODE_ENV='test';
process.env.MEDIA_STORAGE='local';
process.env.UPLOAD_DIR=directory;
for(const name of ['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET',
 'GOOGLE_DRIVE_REFRESH_TOKEN','GOOGLE_DRIVE_FOLDER_ID'])process.env[name]='';
const {screenSellerAvatar}=await import('../src/seller-avatar-screening.js');
type Outcome='safe'|'explicit'|'uncertain'|'unavailable';
type Tallies=Record<Outcome,number>;
const fresh=():Tallies=>({safe:0,explicit:0,uncertain:0,unavailable:0});
const results:Record<Label,Tallies>={allowed:fresh(),prohibited:fresh()};
const expectedFormats:Record<string,string>={jpg:'jpeg',jpeg:'jpeg',png:'png',webp:'webp'};
let attempts=0;
try {
 for(const item of manifest.items) {
  const filename=join(corpus,item.filename);
  let outcome:Outcome='unavailable';
  const tempName=randomBytes(16).toString('hex')+'.webp';
  try {
   // Classify the same normalized avatar crop the actual upload endpoint uses.
   const original=await readFile(filename);
   const input=sharp(original,{failOn:'warning',limitInputPixels:24_000_000});
   const md=await input.metadata();
   const ext=item.filename.split('.').at(-1)!.toLowerCase();
   if(md.format!==expectedFormats[ext] || !md.width || !md.height ||
      md.width*md.height>24_000_000 || (md.pages??1)>1)
    throw new Error('Invalid local evaluation image');
   const webp=await sharp(original,{failOn:'warning',limitInputPixels:24_000_000})
     .rotate().resize({width:512,height:512,fit:'cover',position:'centre'})
     .webp({quality:82,effort:4}).toBuffer();
   if(webp.length>3*1024*1024)throw new Error('Normalized image too large');
   await writeFile(join(directory,tempName),webp,{flag:'wx',mode:0o600});
   try {
    await screenSellerAvatar(tempName);
    outcome='safe';
   } catch(error){
    const code=(error as {code?:string}).code;
    outcome=code==='avatar_explicit_content'?'explicit':
      code==='avatar_uncertain_content'?'uncertain':'unavailable';
   }
  } catch{
   outcome='unavailable';
  } finally {
   await rm(join(directory,tempName),{force:true});
  }
  attempts++;
  results[item.label][outcome]++;
 }
 const allowed=results.allowed;
 const prohibited=results.prohibited;
 const allowedCount=Object.values(allowed).reduce((s,n)=>s+n,0);
 const prohibitedCount=Object.values(prohibited).reduce((s,n)=>s+n,0);
 const coverage=allowedCount>0 && prohibitedCount>0?'BOTH_LABELS':'INCOMPLETE_LABEL_COVERAGE';
 console.log(JSON.stringify({
  suite:'OFFLINE_AUTHORIZED_AVATAR_EVALUATION',status:coverage,
  total:attempts,labels:{allowed:allowedCount,prohibited:prohibitedCount},
  outcomesByLabel:results,
  prohibitedPublishedSafe:prohibited.safe,
  prohibitedBlockedOrHeld:prohibited.explicit+prohibited.uncertain,
  allowedWronglyRejectedOrHeld:allowed.explicit+allowed.uncertain,
  technicalFailures:allowed.unavailable+prohibited.unavailable,
  noRemoteUpload:true,noImageOrPathLogging:true,temporaryImagesDeleted:true,
 }));
 if(prohibited.safe>0 || allowed.unavailable+prohibited.unavailable>0)process.exitCode=1;
} finally {
 await rm(directory,{recursive:true,force:true,maxRetries:10,retryDelay:120});
}
