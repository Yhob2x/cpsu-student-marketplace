import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { inspectMigrationFiles, perfMigrationApprovalProblems, appliedPerfMigrationProblems } from '../src/perf-migration-policy.js';

const current = [
  { name: '20261110063101_init', sha256: 'a'.repeat(64) },
  { name: '20261119150000_push_delivery_outbox', sha256: 'b'.repeat(64) },
];
const approved = {
  purpose: 'isolated-local-performance', databaseName: 'cpsu_marketplace_perf',
  hostApprovalReference: 'ICT-REF-2026-001', privacyApprovalReference: 'PRIVACY-REF-2026-002',
  migrationApprovalReference: 'SCHEMA-REF-2026-003', syntheticDataApproved: true,
  reviewedMigrations: current,
};
const finished = new Date('2026-11-19T05:00:00.000Z');
const applied = current.map(row => ({ migration_name: row.name, checksum: row.sha256,
  finished_at: finished, rolled_back_at: null }));

describe('offline migration fingerprint gate', () => {
  test('reads only local checked-in migration SQL and emits name/hash metadata', () => {
    const files = inspectMigrationFiles(join(import.meta.dir, '..', 'prisma', 'migrations'));
    expect(files.length).toBeGreaterThanOrEqual(14);
    expect(files.every(x => /^\d{14}_[a-z0-9_]+$/.test(x.name) && /^[0-9a-f]{64}$/.test(x.sha256))).toBe(true);
    expect(files.some(x => x.name === '20261119150000_push_delivery_outbox')).toBe(true);
  });
  test('all approvals, exact migration names, checksum and uniqueness required', () => {
    expect(perfMigrationApprovalProblems(approved, current)).toEqual([]);
    expect(perfMigrationApprovalProblems(null, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, syntheticDataApproved: false }, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, hostApprovalReference: 'pending' }, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, reviewedMigrations: [current[0]] }, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, reviewedMigrations: [current[0], { ...current[1], sha256: 'c'.repeat(64) }] }, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, reviewedMigrations: [...current, current[1]] }, current)).not.toEqual([]);
    expect(perfMigrationApprovalProblems({ ...approved, reviewedMigrations: [{ ...current[0], name: '../unsafe' }, current[1]] }, current)).not.toEqual([]);
  });
  test('actual database migration history must also match and be complete', () => {
    expect(appliedPerfMigrationProblems(applied, current)).toEqual([]);
    expect(appliedPerfMigrationProblems(applied.slice(0, 1), current)).not.toEqual([]);
    expect(appliedPerfMigrationProblems([...applied, applied[0]], current)).not.toEqual([]);
    expect(appliedPerfMigrationProblems([{ ...applied[0], checksum: 'c'.repeat(64) }, applied[1]], current)).not.toEqual([]);
    expect(appliedPerfMigrationProblems([{ ...applied[0], finished_at: null }, applied[1]], current)).not.toEqual([]);
    expect(appliedPerfMigrationProblems([{ ...applied[0], rolled_back_at: finished }, applied[1]], current)).not.toEqual([]);
  });
});
