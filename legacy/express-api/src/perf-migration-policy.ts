import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export type MigrationFingerprint = { name: string; sha256: string };
type Approval = {
  purpose?: unknown; databaseName?: unknown;
  hostApprovalReference?: unknown; privacyApprovalReference?: unknown;
  migrationApprovalReference?: unknown; syntheticDataApproved?: unknown;
  reviewedMigrations?: unknown;
};
const approvedSchema = 'cpsu_marketplace_perf';
const migrationName = /^[0-9]{14}_[a-z0-9_]+$/;

/** Read code-only migration SQL metadata. Never connect to or mutate a database. */
export function inspectMigrationFiles(dir: string): MigrationFingerprint[] {
  if (!isAbsolute(dir) || !existsSync(dir)) throw new Error('Migration inventory directory missing');
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.isSymbolicLink())
    .map(entry => entry.name).sort();
  if (!folders.length) throw new Error('Migration directory is empty');
  return folders.map(name => {
    if (!migrationName.test(name)) throw new Error('Unexpected migration directory name');
    const path = join(dir, name, 'migration.sql');
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
      throw new Error('Missing, non-regular or linked migration.sql');
    const sql = readFileSync(path);
    if (!sql.length) throw new Error('Empty migration.sql is not approved');
    return { name, sha256: createHash('sha256').update(sql).digest('hex') };
  });
}

/** An exact, reviewable migration and approval snapshot. Flags alone are not enough. */
export type AppliedMigration = {
  migration_name: string; checksum: string;
  finished_at: Date | null; rolled_back_at: Date | null;
};

/** Verify exact applied history. Only read-only SELECT is permitted by the caller. */
export function appliedPerfMigrationProblems(applied: AppliedMigration[], current: MigrationFingerprint[]): string[] {
  const problems: string[] = [];
  if (applied.length !== current.length) problems.push('Applied migration count differs from approved source');
  const seen = new Set<string>();
  const expected = new Map(current.map(item => [item.name, item.sha256]));
  for (const row of applied) {
    if (!row || typeof row.migration_name !== 'string') {
      problems.push('Malformed applied migration row'); continue;
    }
    if (seen.has(row.migration_name)) problems.push('Duplicate applied migration');
    seen.add(row.migration_name);
    if (!expected.has(row.migration_name) || expected.get(row.migration_name) !== row.checksum)
      problems.push('Applied migration name/checksum does not match approved source: ' + row.migration_name);
    if (!row.finished_at || row.rolled_back_at)
      problems.push('Incomplete or rolled-back applied migration: ' + row.migration_name);
  }
  for (const item of current) {
    if (!seen.has(item.name)) problems.push('Missing applied migration: ' + item.name);
  }
  return problems;
}

export function perfMigrationApprovalProblems(approval: Approval | null, current: MigrationFingerprint[]): string[] {
  const problems: string[] = [];
  if (!approval || typeof approval !== 'object') return ['Private migration approval record missing'];
  if (approval.purpose !== 'isolated-local-performance') problems.push('Wrong approval purpose');
  if (approval.databaseName !== approvedSchema) problems.push('Wrong approved schema');
  if (approval.syntheticDataApproved !== true) problems.push('Synthetic data scope is not approved');
  for (const name of ['hostApprovalReference', 'privacyApprovalReference', 'migrationApprovalReference'] as const) {
    const value = approval[name];
    if (typeof value !== 'string' || value.trim().length < 8 ||
        /placeholder|example|pending|todo|approved_here/i.test(value))
      problems.push('Missing documented ' + name);
  }
  const reviewed = approval.reviewedMigrations;
  if (!Array.isArray(reviewed)) return [...problems, 'Approved migration fingerprints missing'];
  if (reviewed.length !== current.length) problems.push('Migration inventory changed or was not fully approved');
  const seen = new Set<string>();
  const approved = new Map<string, string>();
  for (const entry of reviewed) {
    if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string' ||
        typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256) ||
        !migrationName.test(entry.name)) {
      problems.push('Malformed approved migration fingerprint');
      continue;
    }
    if (seen.has(entry.name)) problems.push('Duplicate approved migration');
    seen.add(entry.name);
    approved.set(entry.name, entry.sha256);
  }
  for (const item of current) {
    if (approved.get(item.name) !== item.sha256)
      problems.push('Missing, changed or unapproved migration: ' + item.name);
  }
  for (const name of approved.keys()) {
    if (!current.some(item => item.name === name))
      problems.push('Approved migration no longer exists: ' + name);
  }
  return problems;
}
