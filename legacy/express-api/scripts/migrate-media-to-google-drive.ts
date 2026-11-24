import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/db.js';
import { env } from '../src/env.js';
import { googleDriveFromEnv, localMediaFile, driveMediaId } from '../src/media-storage.js';

// Default is read-only. Migration is explicit and retains every local original.
// Before --execute: verify a restorable DB+uploads backup and pause seller uploads.
const execute = process.argv.includes('--execute');
if (execute && (!process.argv.includes('--backup-confirmed') || !process.argv.includes('--uploads-paused-confirmed')))
  throw new Error('Migration blocked. Require --execute --backup-confirmed --uploads-paused-confirmed.');
if (execute && !env.GOOGLE_DRIVE_FOLDER_ID) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID before executing.');

let eligible = 0;
let missing = 0;
let alreadyDrive = 0;
let migrated = 0;
const drive = execute ? googleDriveFromEnv() : null;
try {
  const media = await prisma.listingMedia.findMany({ select: { id: true, mediaPath: true, mimeType: true }, orderBy: { id: 'asc' } });
  for (const record of media) {
    if (driveMediaId(record.mediaPath)) { alreadyDrive++; continue; }
    let localPath: string;
    try { localPath = localMediaFile(record.mediaPath); }
    catch { console.error(`Media row ${record.id} has an invalid local filename; aborting.`); throw new Error('Invalid media reference.'); }
    let content: Buffer;
    try { content = await fs.readFile(localPath); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      console.warn(`Media row ${record.id}: local file not found.`);
      missing++;
      continue;
    }
    if (!content.length || content.length > 3 * 1024 * 1024) throw new Error(`Invalid media bytes in row ${record.id}`);
    eligible++;
    if (!execute) continue;
    const fileId = await drive!.uploadToFolder(content, path.basename(localPath), record.mimeType, env.GOOGLE_DRIVE_FOLDER_ID!);
    const nextPath = `gdrive:${fileId}`;
    try {
      const updated = await prisma.listingMedia.updateMany({
        where: { id: record.id, mediaPath: record.mediaPath },
        data: { mediaPath: nextPath },
      });
      if (updated.count !== 1) throw new Error(`Media row ${record.id} changed during migration. Stop and reconcile.`);
      migrated++;
      console.log(`Migrated media row ${record.id} (original kept locally).`);
    } catch (error) {
      await drive!.delete(fileId).catch(() => console.error('Drive rollback failed; review orphan files manually.'));
      throw error;
    }
  }
  console.log(JSON.stringify({ mode: execute ? 'executed' : 'read_only', rows: eligible + missing + alreadyDrive,
    eligible, missing, alreadyDrive, migrated, localOriginalsDeleted: false }));
  if (missing) throw new Error('Some database media references have no local file. Investigate before switching.');
} finally {
  await prisma.$disconnect();
}
