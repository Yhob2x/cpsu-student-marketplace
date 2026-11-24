/**
 * WP3 Gate A ONLY: independently restore a private retained local development backup
 * into an empty, disposable local MySQL database and replay the pinned WP3 migration.
 *
 * bun scripts/verify-wp3-retained-restore.ts --gate-a "C:\\Users\\...\\backups\\TIMESTAMP"
 * Never writes application/development tables, changes credentials, deploys or sends push.
 * A failed rehearsal retains its created sandbox for private diagnostics; only success cleans up.
 */
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, realpathSync, copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import {
  WP3_SOURCE, WP3_RESTORE, WP3_MIGRATION, EXPECTED_TABLES,
  assertSourceUrl, assertRestoreName, assertBackupLocation, assertDump,
  assertBackupManifest, compareSnapshots, assertWp3Migration, assertRestoredDumpRowsMatch, assertUnchangedExceptSessions, projectLegacyRow, canonicalRowsHash, assertSameLegacyListingRows,
  assertSandboxVacant, selectIsolatedWp3Chain,
  type BackupManifest, type Snapshot,
} from './wp3-restore-safety.js';

if (process.argv.length !== 4 || process.argv[2] !== '--gate-a') {
  throw new Error('Gate A needs --gate-a and a private retained snapshot directory.');
}
assertRestoreName(WP3_RESTORE);
const sourceURL = assertSourceUrl(process.env.DATABASE_URL ?? '', process.env.NODE_ENV);
const restoreURL = new URL(sourceURL.toString());
restoreURL.pathname = '/' + WP3_RESTORE;
const backup = resolve(process.argv[3]);
assertBackupLocation(backup, homedir());
if (realpathSync(backup).toLowerCase() !== backup.toLowerCase())
  throw new Error('Backup directory cannot be a symlink.');
const manifest = JSON.parse(readFileSync(join(backup, 'manifest.json'), 'utf8')) as BackupManifest & { createdAt?: string };
if (!manifest.createdAt || !Number.isFinite(Date.parse(manifest.createdAt)) ||
    Date.now() - Date.parse(manifest.createdAt) > 2 * 60 * 60_000 ||
    Date.parse(manifest.createdAt) > Date.now() + 60_000) {
  throw new Error('Snapshot must be a fresh retained backup from this Gate A run.');
}
const sqlBytes = readFileSync(join(backup, 'cpsu_marketplace.sql'));
if (sqlBytes.length < 1000) throw new Error('Retained SQL backup is unexpectedly small.');
assertDump(sqlBytes.toString('utf8'));

type Row = Record<string, any>;
const ident = (name: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Unsafe SQL catalog identifier.');
  return '`' + name + '`';
};
const digest = canonicalRowsHash;

function fileHashes(dir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(dir)) return result;
  const walk = (here: string) => {
    for (const entry of readdirSync(here, { withFileTypes: true })) {
      const name = join(here, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Uploaded photo tree contains an unsafe symlink.');
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) {
        const key = relative(dir, name).replaceAll('\\', '/');
        result[key] = createHash('sha256').update(readFileSync(name)).digest('hex');
      } else throw new Error('Unsupported upload file type.');
    }
  };
  walk(dir);
  return result;
}
function assertFileTreeSame(expected: Record<string, string>, actual: Record<string, string>) {
  if (JSON.stringify(Object.entries(expected).sort()) !== JSON.stringify(Object.entries(actual).sort()))
    throw new Error('Retained upload files differ from the source files.');
}

const backedUploads = fileHashes(join(backup, 'uploads'));
assertBackupManifest(manifest, sqlBytes, Object.keys(backedUploads).length);
const sourceUploads = resolve(process.env.UPLOAD_DIR ?? './uploads');
assertFileTreeSame(backedUploads, fileHashes(sourceUploads));
console.log('BACKUP PASS: private retained SQL checksum, 22-table catalog and upload digests match (no student data logged).');

const migrationPath = resolve(import.meta.dir, '../prisma/migrations', WP3_MIGRATION, 'migration.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');
assertWp3Migration(migrationSQL);
const source = new PrismaClient({ datasources: { db: { url: sourceURL.toString() } } });
let restore: PrismaClient | undefined;
let sandboxCreated = false;
let rehearsalComplete = false;
let isolatedRoot: string | undefined;
let isolatedSchemaPath: string | undefined;
let fullInventoryFingerprint = '';

async function tables(db: PrismaClient): Promise<string[]> {
  const list = await db.$queryRawUnsafe<{ name: string }[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME");
  return list.map(t => t.name.toLowerCase()).sort();
}
async function snapshot(db: PrismaClient): Promise<Snapshot> {
  const result: Snapshot = {};
  for (const name of await tables(db)) {
    const pk = await db.$queryRawUnsafe<{ name: string }[]>(
      "SELECT COLUMN_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION", name);
    if (!pk.length) throw new Error('Restored table has no primary key: ' + name);
    const order = pk.map(k => ident(k.name)).join(', ');
    const rows = await db.$queryRawUnsafe<Row[]>('SELECT * FROM ' + ident(name) + ' ORDER BY ' + order);
    result[name] = { count: rows.length, hash: digest(rows.map(row => projectLegacyRow(name, row))) };
  }
  return result;
}
async function history(db: PrismaClient): Promise<{ names: string[]; count: number; hash: string }> {
  const rows = await db.$queryRawUnsafe<Row[]>(
    'SELECT * FROM `_prisma_migrations` WHERE migration_name <> ? ORDER BY id', WP3_MIGRATION);
  const names = rows.filter(r => r.finished_at != null && r.rolled_back_at == null).map(r => String(r.migration_name));
  if (rows.length !== names.length) throw new Error('Failed/incomplete migration found in baseline history.');
  return { names, count: rows.length, hash: digest(rows) };
}
function restoredLogicalDump(): string {
  // Dump only the disposable sandbox using the SAME options as the retained
  // source backup. Capture private SQL in memory; never emit student rows.
  const child = spawnSync('C:\\xampp\\mysql\\bin\\mysqldump.exe', [
    '--protocol=TCP', '--host=' + sourceURL.hostname, '--port=' + (sourceURL.port || '3306'),
    '--user=' + decodeURIComponent(sourceURL.username), '--single-transaction',
    '--quick', '--hex-blob', '--skip-add-drop-table', '--default-character-set=utf8mb4',
    '--routines', '--triggers', '--events', WP3_RESTORE,
  ], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(sourceURL.password) },
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    windowsHide: true, timeout: 120_000 });
  if (child.error || child.status !== 0)
    throw new Error('Read-only restored database dump failed.');
  return String(child.stdout);
}
function runImport() {
  const file = join(backup, 'cpsu_marketplace.sql');
  const fd = openSync(file, 'r');
  try {
    const child = spawnSync('C:\\xampp\\mysql\\bin\\mysql.exe', [
      '--protocol=TCP', '--host=' + sourceURL.hostname, '--port=' + (sourceURL.port || '3306'),
      '--user=' + decodeURIComponent(sourceURL.username),
      '--default-character-set=utf8mb4', '--database=' + WP3_RESTORE,
    ], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(sourceURL.password) },
      stdio: [fd, 'ignore', 'pipe'], windowsHide: true, timeout: 120_000 });
    if (child.error || child.status !== 0) throw new Error('SQL import failed in disposable sandbox; examine private MySQL diagnostics.');
  } finally { closeSync(fd); }
}
async function prismaInSandbox(action: 'status' | 'deploy') {
  if (!isolatedSchemaPath) throw new Error('Approved isolated schema directory was not prepared.');
  const child = Bun.spawn(['bunx', 'prisma', 'migrate', action, '--schema', isolatedSchemaPath], {
    cwd: resolve(import.meta.dir, '..'),
    env: { ...process.env, DATABASE_URL: restoreURL.toString(), NODE_ENV: 'test', BUN_ENV: 'test' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const [output, errors, exit] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  // Prisma migrate status exits 1 when a *known pending migration* exists.
  // Only that status exit is acceptable; migrate deploy must exit 0.
  const expectedPending = action === 'status' && exit === 1 &&
    (output + errors).includes('not yet been applied') &&
    (output + errors).includes(WP3_MIGRATION);
  if ((exit !== 0 && !expectedPending) || !(output + errors).includes(WP3_RESTORE))
    throw new Error('Prisma sandbox ' + action + ' refused: unexpected exit or target identity. Exit=' + exit);
  return output + errors;
}
const originalMigrationNames = [
  '20261110063101_init', '20261110090354_message_status',
  '20261111160700_stage1_integrity', '20261111161500_wp2_listing_states',
  '20261116094000_pwa_push_notifications',
].sort();

try {
  const current = await source.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  if (current[0]?.name !== WP3_SOURCE) throw new Error('Source query target identity mismatch.');
  const names = await tables(source);
  if (names.join('|') !== [...EXPECTED_TABLES].sort().join('|')) throw new Error('Source schema changed since approved WP3 preflight.');
  const oldHistory = await history(source);
  if (oldHistory.names.sort().join('|') !== originalMigrationNames.join('|'))
    throw new Error('Development migration history does not match the approved baseline.');
  // Cooperative freeze boundary: snapshot EVERY source migration SQL and later reject concurrent changes.
  // Extra pending migrations are deliberately EXCLUDED from a private, WP3-only temp directory.
  const repositoryMigrations = resolve(import.meta.dir, '../prisma/migrations');
  const inventory = () => {
    const dirNames = readdirSync(repositoryMigrations, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^\d{14}_/.test(e.name)).map(e => e.name).sort();
    const sqlHashes = dirNames.map(name => [name, createHash('sha256').update(
      readFileSync(join(repositoryMigrations, name, 'migration.sql'))).digest('hex')]);
    return { dirs: dirNames, fingerprint: digest(sqlHashes) };
  };
  const initialInventory = inventory();
  const selected = selectIsolatedWp3Chain(initialInventory.dirs, oldHistory.names);
  fullInventoryFingerprint = initialInventory.fingerprint;
  console.log('WP3-ONLY MIGRATION CHAIN: five approved applied + pinned WP3; ' +
    selected.excluded.length + ' unrelated pending migration(s) excluded WITHOUT modifying source.');
  isolatedRoot = mkdtempSync(join(tmpdir(), 'cpsu-wp3-gate-a-only-'));
  const prismaScratch = join(isolatedRoot, 'prisma');
  const migrationsScratch = join(prismaScratch, 'migrations');
  mkdirSync(migrationsScratch, { recursive: true });
  isolatedSchemaPath = join(prismaScratch, 'schema.prisma');
  copyFileSync(resolve(import.meta.dir, '../prisma/schema.prisma'), isolatedSchemaPath);
  copyFileSync(join(repositoryMigrations, 'migration_lock.toml'), join(migrationsScratch, 'migration_lock.toml'));
  for (const name of selected.selected) {
    cpSync(join(repositoryMigrations, name), join(migrationsScratch, name), { recursive: true, force: false });
    const original = readFileSync(join(repositoryMigrations, name, 'migration.sql'));
    const copied = readFileSync(join(migrationsScratch, name, 'migration.sql'));
    if (!original.equals(copied)) throw new Error('Private migration copy differs from approved source: ' + name);
  }
  const scratchNames = readdirSync(migrationsScratch, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
  if (scratchNames.join('|') !== selected.selected.slice().sort().join('|'))
    throw new Error('Private WP3-only migration catalog is not exact.');
  if (inventory().fingerprint !== fullInventoryFingerprint)
    throw new Error('Source migration changed while preparing private WP3 chain.');
  const existing = await source.$queryRawUnsafe<Row[]>(
    'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', WP3_RESTORE);
  assertSandboxVacant(existing.length);
  const pre = await snapshot(source);
  console.log('READ-ONLY DEVELOPMENT SNAPSHOT: ' + Object.keys(pre).length + ' tables, ' +
    Object.values(pre).reduce((sum, t) => sum + t.count, 0) + ' rows; no values disclosed.');

  // The only CREATE DATABASE below targets the exact, previously absent sandbox name.
  await source.$executeRawUnsafe('CREATE DATABASE ' + ident(WP3_RESTORE) +
    ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  sandboxCreated = true;
  runImport();
  restore = new PrismaClient({ datasources: { db: { url: restoreURL.toString() } } });
  const targetIdentity = await restore.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  if (targetIdentity[0]?.name !== WP3_RESTORE) throw new Error('Restored connection points at wrong schema.');
  const restoredBefore = await snapshot(restore);
  const originalListingRows = await restore.$queryRawUnsafe<Row[]>('SELECT * FROM `listing` ORDER BY `id`');
  // Compare each logical INSERT in the retained SQL with an independent
  // re-dump from the disposable restored sandbox. Live login sessions
  // legitimately change between backup time and restore time.
  assertRestoredDumpRowsMatch(sqlBytes.toString('utf8'), restoredLogicalDump());
  assertUnchangedExceptSessions(pre, restoredBefore);
  const restoredHistory = await history(restore);
  if (oldHistory.hash !== restoredHistory.hash || oldHistory.count !== restoredHistory.count)
    throw new Error('Migration history does not match original SQL backup.');
  // Detect any development writes after backup, including existing table rows.
  assertUnchangedExceptSessions(pre, await snapshot(source));
  assertFileTreeSame(backedUploads, fileHashes(sourceUploads));
  console.log('RESTORE PASS: retained SQL row hashes match independent sandbox re-dump; all non-session source tables match; uploads unchanged.');

  if (inventory().fingerprint !== fullInventoryFingerprint)
    throw new Error('Concurrent migration changes detected; refusing Prisma migration.');
  const preview = await prismaInSandbox('status');
  if (!preview.includes(WP3_MIGRATION) || !preview.includes('not yet been applied'))
    throw new Error('Sandbox migration preview did not show exactly the pending WP3 migration.');
  if (inventory().fingerprint !== fullInventoryFingerprint)
    throw new Error('Concurrent migration changes detected; refusing Prisma migration.');
  // The child uses the private WP3-only migration directory and disposable database URL.
  await prismaInSandbox('deploy');
  // A Prisma query engine created before ALTER TABLE may cache old field metadata
  // and return a new column as f19. Reconnect to introspect the actual new schema.
  await restore.$disconnect();
  restore = new PrismaClient({ datasources: { db: { url: restoreURL.toString() } } });
  const afterIdentity = await restore.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  if (afterIdentity[0]?.name !== WP3_RESTORE)
    throw new Error('Post-migration sandbox connection identity mismatch.');
  const after = await snapshot(restore);
  const migratedListingRows = await restore.$queryRawUnsafe<Row[]>('SELECT * FROM `listing` ORDER BY `id`');
  assertSameLegacyListingRows(originalListingRows, migratedListingRows);
  // Listing gets one brand-new nullable column; verify every old field separately
  // above rather than requiring identical raw table-row serialization after ALTER.
  const previousRows = Object.fromEntries(Object.keys(restoredBefore)
    .filter(n => !['_prisma_migrations', 'listing'].includes(n)).map(n => [n, after[n]])) as Snapshot;
  const oldWithoutHistory = Object.fromEntries(Object.entries(restoredBefore)
    .filter(([n]) => !['_prisma_migrations', 'listing'].includes(n))) as Snapshot;
  const lateSource = await snapshot(source);
  console.log('WP3 LISTING AUDIT: restoredBeforeCount='+restoredBefore.listing?.count +
    ' restoredAfterCount='+after.listing?.count+' prePostDigestEqual=' +
    (restoredBefore.listing?.hash === after.listing?.hash) +
    ' livePreDigestEqual=' + (pre.listing?.hash === restoredBefore.listing?.hash) +
    ' liveLateVsPre=' + (lateSource.listing?.hash === pre.listing?.hash) +
    ' liveLateVsRestoredAfter=' + (lateSource.listing?.hash === after.listing?.hash));
  compareSnapshots(oldWithoutHistory, previousRows);
  const newHistory = await history(restore);
  if (newHistory.hash !== oldHistory.hash || newHistory.count !== oldHistory.count ||
      after['_prisma_migrations'].count !== pre['_prisma_migrations'].count + 1)
    throw new Error('WP3 migration changed previously applied migration history.');
  const applied = await restore.$queryRawUnsafe<Row[]>(
    'SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations` WHERE migration_name = ?', WP3_MIGRATION);
  if (applied.length !== 1 || !applied[0].finished_at || applied[0].rolled_back_at)
    throw new Error('Sandbox WP3 migration did not complete successfully.');

  const foreign = await restore.$queryRawUnsafe<{ name: string }[]>(
    "SELECT CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL");
  const fkNames = new Set(foreign.map(f => f.name.toLowerCase()));
  const expectedFks = [
    'Listing_reservationTransactionId_fkey', 'Transaction_inquiryThreadId_fkey',
    'Transaction_listingId_fkey', 'Transaction_buyerUserId_fkey',
    'Transaction_sellerUserId_fkey', 'TransactionStatusLog_transactionId_fkey',
    'TransactionStatusLog_actorUserId_fkey',
  ];
  if (expectedFks.some(f => !fkNames.has(f.toLowerCase())))
    throw new Error('A required WP3 foreign key is missing after sandbox migration.');
  const indexes = await restore.$queryRawUnsafe<{ name: string }[]>(
    "SELECT DISTINCT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()");
  const indexNames = new Set(indexes.map(i => i.name.toLowerCase()));
  if (['Transaction_activeThreadId_key', 'Listing_reservationTransactionId_key',
       'TransactionStatusLog_transactionId_id_idx'].some(i => !indexNames.has(i.toLowerCase())))
    throw new Error('WP3 unique or history index missing.');
  const tx = after['transaction']; const logs = after['transactionstatuslog'];
  if (!tx || !logs || tx.count !== 0 || logs.count !== 0)
    throw new Error('WP3 sandbox new tables missing or unexpectedly contain rows.');
  // Source remains unmodified; no client writes into development occur anywhere in the script.
  assertUnchangedExceptSessions(pre, await snapshot(source));
  assertFileTreeSame(backedUploads, fileHashes(sourceUploads));
  console.log('WP3 SANDBOX MIGRATION PASS: seven FKs, indexes, empty new tables, migration history +1.');
  console.log('SOURCE SAFETY PASS: development non-session row hashes and all upload hashes unchanged; no source writes by runner.');

  await restore.$disconnect();
  restore = undefined;
  await source.$executeRawUnsafe('DROP DATABASE ' + ident(WP3_RESTORE));
  sandboxCreated = false;
  rehearsalComplete = true;
  console.log('CLEANUP PASS: only the script-created disposable sandbox was removed.');
  console.log('GATE A PASS: retained backup preserved; no development/production migration, commit, push or deploy.');
} catch (e) {
  console.error('GATE A STOP: ' + (e instanceof Error ? e.message : 'Unexpected verification failure.'));
  if (sandboxCreated) console.error('PRIVATE REVIEW REQUIRED: the script-created local sandbox remains; do not modify source DB.');
  process.exitCode = 1;
} finally {
  if (restore) await restore.$disconnect();
  await source.$disconnect();
  if (isolatedRoot) rmSync(isolatedRoot, { recursive: true, force: true });
}
if (!rehearsalComplete) process.exitCode = 1;
