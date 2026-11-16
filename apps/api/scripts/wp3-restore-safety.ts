/**
 * Pure, testable Gate A safety checks. Never expose passwords, backup bytes or student rows.
 * No database or filesystem writes in this module.
 */
import { createHash } from 'node:crypto';
import { basename, join, resolve, sep } from 'node:path';

export const WP3_SOURCE = 'cpsu_marketplace';
export const WP3_RESTORE = 'cpsu_marketplace_wp3_restore';
export const WP3_MIGRATION = '20261116193000_wp3_transactions';
export const WP3_SQL_SHA256 = 'F14FD1971E96BE0F42A4618415D4B94EFBD2D70AD5736D41784ADC14E3B133D5';

export const EXPECTED_TABLES = [
  '_prisma_migrations', 'affiliation', 'auditlog', 'campus', 'campuspolicy', 'category',
  'handoff', 'inquirymessage', 'inquirythread', 'listing', 'listingmedia', 'listingreview',
  'notification', 'pushpreference', 'pushsubscription', 'report', 'restrictedcategory',
  'savedlisting', 'sellerprofile', 'session', 'user', 'userrole',
];

export function assertSourceUrl(raw: string, environment: string | undefined): URL {
  if (environment === 'production' || !raw) throw new Error('Gate A requires local nonproduction source.');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Invalid local database configuration.'); }
  if (url.protocol !== 'mysql:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) ||
      decodeURIComponent(url.pathname.replace(/^\//, '')) !== WP3_SOURCE) {
    throw new Error('Gate A source identity refused: expected local CPSU development only.');
  }
  return url;
}

export function assertRestoreName(name: string): void {
  if (name !== WP3_RESTORE) throw new Error('Unapproved sandbox name.');
}

export function assertBackupLocation(backupRoot: string, home: string): void {
  const parent = resolve(join(home, 'AppData', 'Local', 'CPSU-Marketplace', 'backups'));
  const actual = resolve(backupRoot);
  if (!actual.toLowerCase().startsWith((parent + sep).toLowerCase()) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(basename(actual)) ||
      actual === parent) throw new Error('Backup must be a private dated retained snapshot.');
}

export function assertDump(sql: string): void {
  if (/^\s*(?:USE\b|CREATE\s+DATABASE\b|DROP\s+DATABASE\b|DROP\s+TABLE\b)/im.test(sql)) {
    throw new Error('Backup includes prohibited schema switch or destructive statement.');
  }
  const names = new Set([...sql.matchAll(/^\s*CREATE\s+TABLE\s+`([A-Za-z0-9_]+)`/gim)]
    .map(m => m[1].toLowerCase()));
  if (EXPECTED_TABLES.some(t => !names.has(t)) || names.size !== EXPECTED_TABLES.length) {
    throw new Error('Backup table catalog does not match the approved pre-WP3 development schema.');
  }
}

export type BackupManifest = {
  database: string; backupFilename: string; sqlBytes: number;
  sqlSha256: string; uploadFileCount: number;
};
export function assertBackupManifest(manifest: BackupManifest, sql: Buffer, count: number): void {
  if (manifest.database !== WP3_SOURCE || manifest.backupFilename !== 'cpsu_marketplace.sql' ||
      !Number.isSafeInteger(manifest.sqlBytes) || manifest.sqlBytes !== sql.length ||
      !Number.isSafeInteger(manifest.uploadFileCount) || manifest.uploadFileCount < 0 ||
      manifest.uploadFileCount !== count || !/^[a-f0-9]{64}$/i.test(manifest.sqlSha256) ||
      createHash('sha256').update(sql).digest('hex').toLowerCase() !== manifest.sqlSha256.toLowerCase()) {
    throw new Error('Retained backup integrity verification failed.');
  }
}

export type Snapshot = Record<string, { count: number; hash: string }>;
export function compareSnapshots(expected: Snapshot, observed: Snapshot): void {
  const oldNames = Object.keys(expected).sort();
  const newNames = Object.keys(observed).sort();
  if (oldNames.join('|') !== newNames.join('|')) throw new Error('Table catalog changed in restored database.');
  for (const name of oldNames) {
    if (expected[name].count !== observed[name].count || expected[name].hash !== observed[name].hash) {
      throw new Error('Backup restore row count or digest mismatch in ' + name + '.');
    }
  }
}

export function assertWp3Migration(sql: string): void {
  if (createHash('sha256').update(sql).digest('hex').toUpperCase() !== WP3_SQL_SHA256) {
    throw new Error('WP3 migration SQL hash changed; refusing replay.');
  }
  if (/\b(?:DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM|UPDATE\s+`?User`?)\b/i.test(sql) ||
      !sql.includes('CREATE TABLE `Transaction`') || !sql.includes('CREATE TABLE `TransactionStatusLog`')) {
    throw new Error('WP3 migration is not the approved additive schema.');
  }
}

export function assertSandboxVacant(schemaCount: number): void {
  if (schemaCount !== 0) throw new Error('Sandbox already exists; refusing overwrite.');
}

export function assertOnlyWp3Pending(pending: string[]): void {
  if (pending.length !== 1 || pending[0] !== WP3_MIGRATION) {
    throw new Error('Unexpected migration history; stop before sandbox replay.');
  }
}

export function pendingMigrations(directories: string[], applied: string[]): string[] {
  if (new Set(directories).size !== directories.length) throw new Error('Duplicate migration directory.');
  const pending = directories.filter(d => !applied.includes(d)).sort();
  assertOnlyWp3Pending(pending);
  return pending;
}

/**
 * Builds a migration-directory allowlist for the private restore only.
 * This does NOT alter the repository and does NOT authorize development deploy.
 */
export function selectIsolatedWp3Chain(
  allDirectories: string[], applied: string[],
): { selected: string[]; excluded: string[] } {
  const approvedBaseline = [
    '20261110063101_init', '20261110090354_message_status',
    '20261111160700_stage1_integrity', '20261111161500_wp2_listing_states',
    '20261116094000_pwa_push_notifications',
  ];
  const selected = [...approvedBaseline, WP3_MIGRATION];
  if (new Set(allDirectories).size !== allDirectories.length ||
      applied.length !== approvedBaseline.length ||
      applied.slice().sort().join('|') !== approvedBaseline.slice().sort().join('|') ||
      selected.some(name => !allDirectories.includes(name))) {
    throw new Error('Gate A cannot build approved isolated migration chain from current source.');
  }
  return {
    selected,
    excluded: allDirectories.filter(d => !selected.includes(d)).sort(),
  };
}

/**
 * Independent logical-data restore verification. The SQL from the retained dump
 * must produce exactly the same INSERT statements when the restored sandbox is
 * dumped again with the identical client/options. No student data is logged.
 */
export function assertRestoredDumpRowsMatch(backedSql: string, restoredSql: string): void {
  assertDump(backedSql);
  assertDump(restoredSql);
  const inserts = (sql: string) => {
    const data = new Map<string, string[]>();
    for (const raw of sql.replaceAll('\r\n', '\n').split('\n')) {
      const line = raw.trim();
      const matched = /^INSERT INTO `([a-z0-9_]+)` VALUES \(/i.exec(line);
      if (!matched) continue;
      const key = matched[1].toLowerCase();
      if (!EXPECTED_TABLES.includes(key)) throw new Error('Dump has unapproved data table.');
      const statements = data.get(key) ?? [];
      statements.push(line);
      data.set(key, statements);
    }
    return data;
  };
  const expected = inserts(backedSql), observed = inserts(restoredSql);
  for (const table of EXPECTED_TABLES) {
    const a = expected.get(table) ?? [];
    const b = observed.get(table) ?? [];
    if (a.length !== b.length ||
        createHash('sha256').update(a.join('\n')).digest('hex') !==
        createHash('sha256').update(b.join('\n')).digest('hex')) {
      throw new Error('Retained SQL does not equal restored data for table ' + table + '.');
    }
  }
}

export function assertUnchangedExceptSessions(before: Snapshot, after: Snapshot): void {
  const oldNoSession = Object.fromEntries(Object.entries(before).filter(([name]) => name !== 'session'));
  const newNoSession = Object.fromEntries(Object.entries(after).filter(([name]) => name !== 'session'));
  compareSnapshots(oldNoSession, newNoSession);
}

export function assertSafeScratchCleanup(name: string, tables: string[], applied: string[]): void {
  assertRestoreName(name);
  const baseline = [
    '20261110063101_init','20261110090354_message_status',
    '20261111160700_stage1_integrity','20261111161500_wp2_listing_states',
    '20261116094000_pwa_push_notifications',
  ];
  const preWp3 = tables.slice().sort().join('|') === EXPECTED_TABLES.slice().sort().join('|') &&
    applied.slice().sort().join('|') === baseline.slice().sort().join('|');
  const postWp3 = tables.slice().sort().join('|') ===
    [...EXPECTED_TABLES, 'transaction', 'transactionstatuslog'].sort().join('|') &&
    applied.slice().sort().join('|') === [...baseline, WP3_MIGRATION].sort().join('|');
  if (!preWp3 && !postWp3) {
    throw new Error('Refusing cleanup of a sandbox with unexpected schema or migration history.');
  }
}

/** Verify new WP3 reservation field is empty, then compare old listing values only. */
export function projectLegacyRow(table: string, value: Record<string, unknown>): Record<string, unknown> {
  const row = { ...value };
  if (table.toLowerCase() === 'listing' && Object.prototype.hasOwnProperty.call(row, 'reservationTransactionId')) {
    if (row.reservationTransactionId !== null)
      throw new Error('WP3 migration unexpectedly assigned an existing listing reservation.');
    delete row.reservationTransactionId;
  }
  return row;
}

/** Deterministic row digest; Prisma/MySQL may return unchanged columns in new order after ALTER. */
export function canonicalRowsHash(rows: unknown): string {
  const canonical = JSON.stringify(rows, (_key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** An independent field-by-field comparison for the one table altered by WP3. */
export function assertSameLegacyListingRows(
  before: Record<string, unknown>[], after: Record<string, unknown>[],
): void {
  if (before.length !== after.length) throw new Error('WP3 modified the listing row count.');
  for (let i = 0; i < before.length; i++) {
    const old = projectLegacyRow('listing', before[i]);
    const updated = projectLegacyRow('listing', after[i]);
    const originalColumns = Object.keys(old).sort();
    const updatedColumns = Object.keys(updated).sort();
    if (originalColumns.join('|') !== updatedColumns.join('|')) {
      const oldOnly = originalColumns.filter(k => !updatedColumns.includes(k));
      const newOnly = updatedColumns.filter(k => !originalColumns.includes(k));
      throw new Error('WP3 legacy listing column mismatch: removed=' + oldOnly.join(',') + ' added=' + newOnly.join(','));
    }
    for (const key of originalColumns) {
      if (JSON.stringify(old[key]) !== JSON.stringify(updated[key]))
        throw new Error('WP3 changed the legacy listing field ' + key + '.');
    }
  }
}
