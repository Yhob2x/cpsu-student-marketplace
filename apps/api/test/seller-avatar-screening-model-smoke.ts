/**
 * Standalone opt-in model smoke with generated, synthetic non-sensitive picture.
 * Uses its own temporary upload directory, no database or Google Drive.
 * bun test/seller-avatar-screening-model-smoke.ts --synthetic-only
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
if (process.argv.length !== 3 || process.argv[2] !== '--synthetic-only')
  throw new Error('Explicit --synthetic-only required');
const dir=await mkdtemp(join(tmpdir(),'cpsu-nsfw-model-smoke-'));
process.env.UPLOAD_DIR=dir;
process.env.MEDIA_STORAGE='local';
process.env.NODE_ENV='test';
try {
 const { screenSellerAvatar }=await import('../src/seller-avatar-screening.js');
 const name='0123456789abcdef0123456789abcdef.webp';
 const bytes=await sharp({create:{width:512,height:512,channels:3,background:'#e8eadf'}})
   .webp().toBuffer();
 await writeFile(join(dir,name),bytes);
 try {
   await screenSellerAvatar(name);
   console.log('REAL_NSFW_MODEL_SMOKE=PASS SYNTHETIC_IMAGE_VERDICT=safe');
 } catch (e) {
   const err=e as {status?:number;code?:string};
   if (err.status===422 && ['avatar_uncertain_content','avatar_explicit_content'].includes(err.code??'')) {
     console.log('REAL_NSFW_MODEL_SMOKE=PASS SYNTHETIC_IMAGE_VERDICT='+err.code);
   } else throw e;
 }
} finally { await rm(dir,{force:true,recursive:true}); }
