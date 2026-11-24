/** One-time Gate A cleanup of own failed restore ONLY. No source schema/table DML. */
import { PrismaClient } from '@prisma/client';
import { assertSourceUrl, WP3_RESTORE, assertSafeScratchCleanup } from './wp3-restore-safety.js';
if (process.argv.length !== 3 || process.argv[2] !== '--cleanup-owned-failed-restore')
  throw new Error('Explicit one-time cleanup authorization flag required.');
const source = assertSourceUrl(process.env.DATABASE_URL ?? '', process.env.NODE_ENV);
const sandbox = new URL(source.toString()); sandbox.pathname = '/' + WP3_RESTORE;
const p = new PrismaClient({ datasources: { db: { url: sandbox.toString() } } });
const admin = new PrismaClient({ datasources: { db: { url: source.toString() } } });
try {
  const sourceIdentity = await admin.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  const targetIdentity = await p.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  if (sourceIdentity[0]?.name !== 'cpsu_marketplace' || targetIdentity[0]?.name !== WP3_RESTORE)
    throw new Error('Database identity guard denied cleanup.');
  const tables = await p.$queryRawUnsafe<{ name: string }[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
  const history = await p.$queryRawUnsafe<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]>(
    'SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations`');
  if (history.some(h => !h.finished_at || h.rolled_back_at))
    throw new Error('Scratch history contains incomplete or rolled-back migrations.');
  assertSafeScratchCleanup(targetIdentity[0].name, tables.map(t => t.name.toLowerCase()), history.map(h => h.migration_name));
  await p.$disconnect();
  // Deletes only the sandbox created in this Gate A session after exact identity and schema guards.
  await admin.$executeRawUnsafe('DROP DATABASE `cpsu_marketplace_wp3_restore`');
  console.log('OWNED SCRATCH CLEANUP PASS: previous failed rehearsal sandbox removed; development untouched.');
} finally {
  await p.$disconnect();
  await admin.$disconnect();
}
