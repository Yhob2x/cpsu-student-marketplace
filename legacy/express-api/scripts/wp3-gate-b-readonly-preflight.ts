/**
 * READ ONLY WP3 Gate B development preflight:
 *   cd apps/api && bun scripts/wp3-gate-b-readonly-preflight.ts --read-only
 *
 * This file contains no CREATE/ALTER/DROP/INSERT/UPDATE/DELETE, no migrate deploy,
 * no backup creation, no service controls and no deployment capability.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import {
  assessGateB,
  type AppliedMigration, type MigrationOnDisk,
} from './wp3-gate-b-readonly-policy.js';

if (process.argv.length !== 3 || process.argv[2] !== '--read-only')
  throw new Error('Gate B requires --read-only. No migration command is available.');

const databaseUrl = process.env.DATABASE_URL ?? '';
const safeIdentity = (() => {
  try {
    const u = new URL(databaseUrl);
    return u.protocol === 'mysql:' && u.hostname === '127.0.0.1' &&
      u.port === '3306' && u.pathname === '/cpsu_marketplace' &&
      !u.search && !u.hash && process.env.NODE_ENV !== 'production';
  } catch { return false; }
})();
if (!safeIdentity) throw new Error('Gate B refused: not exact local development database identity.');

const migrationRoot = resolve(import.meta.dir, '../prisma/migrations');
function diskInventory(): MigrationOnDisk[] {
  return readdirSync(migrationRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map(entry => ({
      name: entry.name,
      sha256: createHash('sha256')
        .update(readFileSync(join(migrationRoot, entry.name, 'migration.sql')))
        .digest('hex').toUpperCase(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const before = diskInventory();
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const selected = await db.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
  const databaseName = selected[0]?.name ?? '';
  if (databaseName !== 'cpsu_marketplace')
    throw new Error('Gate B refused: database query identity mismatch.');
  const migrationRows = await db.$queryRawUnsafe<{
    migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null
  }[]>('SELECT migration_name, checksum, finished_at, rolled_back_at FROM `_prisma_migrations` ORDER BY started_at, migration_name');
  const applied: AppliedMigration[] = migrationRows.map(m => ({
    name: m.migration_name, checksum: m.checksum, finished: Boolean(m.finished_at),
    rolledBack: Boolean(m.rolled_back_at),
  }));
  const tableRows = await db.$queryRawUnsafe<{ name: string }[]>(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const after = diskInventory();
  const changed = JSON.stringify(before) !== JSON.stringify(after);

  // Deliberately false: this read-only command cannot declare owner's approval,
  // freeze agents or certify a fresh backup and independent restore rehearsal.
  const report = assessGateB({
    databaseUrl, nodeEnv: process.env.NODE_ENV, databaseName,
    diskMigrations: after, applied, databaseTables: tableRows.map(t => t.name),
    coordinatedFreeze: false,
    writtenGateBApproval: false,
    freshBackupRestoreVerified: false,
  });
  if (changed) {
    report.blockers.unshift('migration_files_changed_during_read_only_preflight');
    report.technicalBaselinePass = false;
    report.deploymentAuthorized = false;
  }
  console.log('WP3 GATE B — READ-ONLY PREFLIGHT');
  console.log('Target verified: 127.0.0.1:3306/cpsu_marketplace');
  console.log('Migration inventory: ' + after.length + ' files; applied: ' + applied.length +
    '; pending: ' + (after.length - applied.length) + '.');
  console.log('WP3-only chain length: ' + report.selected.length +
    '; excluded pending migrations: ' + report.outOfScope.join(', '));
  console.log('Technical baseline: ' + (report.technicalBaselinePass ? 'PASS' : 'FAIL'));
  console.log('Activation: NOT AUTHORIZED BY THIS READ-ONLY COMMAND');
  console.log('Blockers: ' + report.blockers.join(', '));
  console.log('No development or production writes, migrations, backups, service stops, pushes or deployments performed.');
  if (!report.technicalBaselinePass) process.exitCode = 2;
} finally {
  await db.$disconnect();
}
