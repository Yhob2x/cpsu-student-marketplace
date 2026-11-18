import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ownedDir = path.resolve(os.tmpdir(), 'cpsu-marketplace-stage1-test-uploads');
const mediaName = /^[a-f0-9]{32}\.(?:webp|jpg|jpeg|png|upload)$/;

/** Fail closed if a non-media object appears during acceptance. */
export function newTestMediaNames(before: ReadonlySet<string>, after: string[]) {
  const fresh = after.filter(name => !before.has(name));
  if (fresh.some(name => !mediaName.test(name))) {
    throw new Error('Refusing to remove an unexpected file in synthetic test media.');
  }
  return fresh;
}

export async function snapshotTestMedia(dir: string): Promise<Set<string>> {
  if (path.resolve(dir) !== ownedDir) throw new Error('Not the dedicated synthetic media directory.');
  await fs.mkdir(ownedDir, { recursive: true });
  return new Set(await fs.readdir(ownedDir));
}

/** Removes ONLY newly created synthetic assets. Never clears prior uploads. */
export async function cleanupNewTestMedia(dir: string, before: ReadonlySet<string>) {
  if (path.resolve(dir) !== ownedDir) throw new Error('Not the dedicated synthetic media directory.');
  const fresh = newTestMediaNames(before, await fs.readdir(ownedDir));
  for (const name of fresh) {
    const location = path.join(ownedDir, name);
    const info = await fs.lstat(location);
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error('Refusing to remove a non-file synthetic media entry.');
    }
    await fs.unlink(location);
  }
  return fresh.length;
}
