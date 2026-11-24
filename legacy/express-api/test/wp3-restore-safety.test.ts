import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  assertSourceUrl, assertRestoreName, assertBackupLocation, assertDump,
  assertBackupManifest, compareSnapshots, assertWp3Migration, assertSandboxVacant, assertOnlyWp3Pending, pendingMigrations, selectIsolatedWp3Chain, assertRestoredDumpRowsMatch, assertUnchangedExceptSessions, assertSafeScratchCleanup, projectLegacyRow, canonicalRowsHash, assertSameLegacyListingRows,
} from '../scripts/wp3-restore-safety.js';

const local = 'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace';

test('Gate A refuses remote, wrong-schema and production database identities', () => {
  expect(() => assertSourceUrl(local, 'development')).not.toThrow();
  for (const url of [
    'mysql://example:secret@remote.example:3306/cpsu_marketplace',
    'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace_test',
    'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace_wp3_restore',
  ]) expect(() => assertSourceUrl(url, 'development')).toThrow();
  expect(() => assertSourceUrl(local, 'production')).toThrow();
  expect(() => assertRestoreName('cpsu_marketplace')).toThrow();
  expect(() => assertRestoreName('cpsu_marketplace_wp3_restore')).not.toThrow();
});

test('Gate A backup location guard rejects directories outside the private retained root', () => {
  const home = 'C:\\Users\\acer';
  const good = join(home, 'AppData', 'Local', 'CPSU-Marketplace', 'backups', '2026-11-16T03-50-59-111Z');
  expect(() => assertBackupLocation(good, home)).not.toThrow();
  expect(() => assertBackupLocation(join(home, 'Downloads', 'leak'), home)).toThrow();
  expect(() => assertBackupLocation(join(home, 'AppData', 'Local', 'CPSU-Marketplace', 'backups'), home)).toThrow();
});

test('Gate A validates dump structure and rejects schema switches or destructive SQL', () => {
  const tables = ['_prisma_migrations','affiliation','auditlog','campus','campuspolicy','category',
    'handoff','inquirymessage','inquirythread','listing','listingmedia','listingreview',
    'notification','pushpreference','pushsubscription','report','restrictedcategory','savedlisting',
    'sellerprofile','session','user','userrole'];
  const safe = tables.map(t => 'CREATE TABLE `' + t + '` (id INT);').join('\n');
  expect(() => assertDump(safe)).not.toThrow();
  expect(() => assertDump(safe + '\nUSE cpsu_marketplace;')).toThrow();
  expect(() => assertDump(safe + '\nDROP TABLE `User`;')).toThrow();
  expect(() => assertDump(safe + '\nCREATE DATABASE x;')).toThrow();
  expect(() => assertDump('CREATE TABLE `user` (id INT);')).toThrow();
});

test('Gate A rejects incorrect manifest checksum and file count', () => {
  const bytes = Buffer.from('test schema fixture');
  const manifest = { database: 'cpsu_marketplace', backupFilename: 'cpsu_marketplace.sql',
    sqlBytes: bytes.length, sqlSha256: createHash('sha256').update(bytes).digest('hex'), uploadFileCount: 22 };
  expect(() => assertBackupManifest(manifest, bytes, 22)).not.toThrow();
  expect(() => assertBackupManifest({ ...manifest, sqlSha256: 'bad' }, bytes, 22)).toThrow();
  expect(() => assertBackupManifest({ ...manifest, database: 'wrong' }, bytes, 22)).toThrow();
  expect(() => assertBackupManifest(manifest, bytes, 21)).toThrow();
});

test('Gate A detects changed records while comparing snapshots without exposing rows', () => {
  const a = { User: { count: 2, hash: 'aa' }, _prisma_migrations: { count: 5, hash: 'bb' } };
  const b = { User: { count: 2, hash: 'aa' }, _prisma_migrations: { count: 5, hash: 'bb' } };
  expect(() => compareSnapshots(a, b)).not.toThrow();
  expect(() => compareSnapshots(a, { ...b, User: { count: 2, hash: 'changed' } })).toThrow();
  expect(() => compareSnapshots(a, { User: b.User })).toThrow();
});

test('Gate A refuses unexpected migration SQL before applying anything', () => {
  expect(() => assertWp3Migration('DROP TABLE `User`')).toThrow();
  expect(() => assertWp3Migration('CREATE TABLE `Transaction` ();')).toThrow();
});

test('Gate A refuses an existing sandbox or additional pending migrations', () => {
  expect(() => assertSandboxVacant(0)).not.toThrow();
  expect(() => assertSandboxVacant(1)).toThrow();
  expect(() => assertOnlyWp3Pending(['20261116193000_wp3_transactions'])).not.toThrow();
  expect(() => assertOnlyWp3Pending(['20261116193000_wp3_transactions','unknown_next'])).toThrow();
  expect(() => assertOnlyWp3Pending([])).toThrow();
});

test('Gate A detects new migration directories not present in development migration history', () => {
  const applied = ['20261110063101_init', '20261116094000_pwa_push_notifications'];
  const dirs = [...applied, '20261116193000_wp3_transactions'];
  expect(pendingMigrations(dirs, applied)).toEqual(['20261116193000_wp3_transactions']);
  expect(() => pendingMigrations([...dirs, '20261116220000_managed_student_content'], applied)).toThrow();
});

test('Gate A isolates five applied migrations plus WP3 and excludes unrelated pending work', () => {
  const applied = ['20261110063101_init', '20261110090354_message_status',
    '20261111160700_stage1_integrity', '20261111161500_wp2_listing_states',
    '20261116094000_pwa_push_notifications'];
  const other = ['20261116220000_managed_student_content', '20261116221000_pending_announcement_edits'];
  const result = selectIsolatedWp3Chain([...applied, '20261116193000_wp3_transactions', ...other], applied);
  expect(result.selected).toEqual([...applied, '20261116193000_wp3_transactions']);
  expect(result.excluded).toEqual(other);
  expect(() => selectIsolatedWp3Chain([...applied, ...other], applied)).toThrow();
  expect(() => selectIsolatedWp3Chain([...applied.slice(1), '20261116193000_wp3_transactions'], applied)).toThrow();
  expect(() => selectIsolatedWp3Chain([...applied, '20261116193000_wp3_transactions'], [...applied, '20261116193000_wp3_transactions'])).toThrow();
});

test('Gate A independently verifies restored SQL row inserts against retained dump, not live sessions', () => {
  const tables = ['_prisma_migrations','affiliation','auditlog','campus','campuspolicy','category',
    'handoff','inquirymessage','inquirythread','listing','listingmedia','listingreview',
    'notification','pushpreference','pushsubscription','report','restrictedcategory','savedlisting',
    'sellerprofile','session','user','userrole'];
  const header = tables.map(t => 'CREATE TABLE `' + t + '` (id INT);').join('\n');
  const backup = header + '\nINSERT INTO `session` VALUES (1),(2);\nINSERT INTO `user` VALUES (1);';
  expect(() => assertRestoredDumpRowsMatch(backup, backup)).not.toThrow();
  expect(() => assertRestoredDumpRowsMatch(backup, header + '\nINSERT INTO `session` VALUES (1);\nINSERT INTO `user` VALUES (1);')).toThrow();
  expect(() => assertRestoredDumpRowsMatch(backup, header + '\nINSERT INTO `session` VALUES (1),(2);')).toThrow();
});
test('Gate A separately detects forbidden source changes while tolerating only new sessions', () => {
  const before = { user: { count: 1, hash: 'u' }, session: { count: 2, hash: 's' },
    listing: { count: 1, hash: 'l' } };
  const later = { user: { count: 1, hash: 'u' }, session: { count: 9, hash: 'changed' },
    listing: { count: 1, hash: 'l' } };
  expect(() => assertUnchangedExceptSessions(before, later)).not.toThrow();
  expect(() => assertUnchangedExceptSessions(before, { ...later, listing: { count: 2, hash: 'l2' } })).toThrow();
});

test('Gate A permits cleanup only of unchanged, unrestored-from-other-source scratch schema', () => {
  const legacy = ['20261110063101_init','20261110090354_message_status',
    '20261111160700_stage1_integrity','20261111161500_wp2_listing_states',
    '20261116094000_pwa_push_notifications'];
  const tables = ['_prisma_migrations','affiliation','auditlog','campus','campuspolicy','category',
    'handoff','inquirymessage','inquirythread','listing','listingmedia','listingreview',
    'notification','pushpreference','pushsubscription','report','restrictedcategory','savedlisting',
    'sellerprofile','session','user','userrole'];
  expect(() => assertSafeScratchCleanup('cpsu_marketplace_wp3_restore', tables, legacy)).not.toThrow();
  expect(() => assertSafeScratchCleanup('cpsu_marketplace', tables, legacy)).toThrow();
  expect(() => assertSafeScratchCleanup('cpsu_marketplace_wp3_restore', tables.slice(1), legacy)).toThrow();
  expect(() => assertSafeScratchCleanup('cpsu_marketplace_wp3_restore', tables, [...legacy, '20261116193000_wp3_transactions'])).toThrow();
});

test('Gate A compares pre-WP3 listing fields while rejecting non-null migrated reservations', () => {
  const original = { id: 1, availabilityState: 'available' };
  expect(projectLegacyRow('listing', { ...original, reservationTransactionId: null })).toEqual(original);
  expect(projectLegacyRow('listing', original)).toEqual(original);
  expect(() => projectLegacyRow('listing', { ...original, reservationTransactionId: 99 })).toThrow();
  expect(projectLegacyRow('user', { id: 1, reservationTransactionId: 99 })).toEqual({ id: 1, reservationTransactionId: 99 });
});
test('Gate A can clean up its own fully migrated WP3 sandbox but never unrelated migrations', () => {
  const baseline=['20261110063101_init','20261110090354_message_status',
  '20261111160700_stage1_integrity','20261111161500_wp2_listing_states',
  '20261116094000_pwa_push_notifications'];
  const prior=['_prisma_migrations','affiliation','auditlog','campus','campuspolicy','category',
  'handoff','inquirymessage','inquirythread','listing','listingmedia','listingreview',
  'notification','pushpreference','pushsubscription','report','restrictedcategory','savedlisting',
  'sellerprofile','session','user','userrole'];
  expect(() => assertSafeScratchCleanup('cpsu_marketplace_wp3_restore',
    [...prior,'transaction','transactionstatuslog'],[...baseline,'20261116193000_wp3_transactions'])).not.toThrow();
  expect(() => assertSafeScratchCleanup('cpsu_marketplace_wp3_restore',
    [...prior,'transaction','transactionstatuslog'],[...baseline,'20261116220000_managed_student_content'])).toThrow();
});

test('Gate A row hashes ignore SQL column ordering without ignoring values', () => {
  expect(canonicalRowsHash([{ id: 1, name: 'same' }]))
    .toBe(canonicalRowsHash([{ name: 'same', id: 1 }]));
  expect(canonicalRowsHash([{ id: 1, name: 'same' }]))
    .not.toBe(canonicalRowsHash([{ id: 1, name: 'changed' }]));
});

test('Gate A compares every legacy Listing field across additive ALTER TABLE without leaking values', () => {
  const before = [{ id: 2, price: '100.00', status: 'published', flags: { a: 1 } },
    { id: 5, price: '90.00', status: 'published', flags: { a: 2 } }];
  const after = [{ ...before[0], reservationTransactionId: null },
    { ...before[1], reservationTransactionId: null }];
  expect(() => assertSameLegacyListingRows(before, after)).not.toThrow();
  expect(() => assertSameLegacyListingRows(before, [{ ...after[0], price: '200.00' }, after[1]])).toThrow();
  expect(() => assertSameLegacyListingRows(before, [after[0]])).toThrow();
  expect(() => assertSameLegacyListingRows(before, [{ ...after[0], reservationTransactionId: 1 }, after[1]])).toThrow();
});
