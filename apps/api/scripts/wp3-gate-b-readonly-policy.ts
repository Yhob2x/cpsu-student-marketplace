/**
 * Gate B WP3-only READ-ONLY planning policy.
 * Pure guard decisions; provides NO database mutation or deployment action.
 */
import { EXPECTED_TABLES, WP3_MIGRATION } from './wp3-restore-safety.js';

export const EXPECTED_MIGRATIONS: Readonly<Record<string, string>> = Object.freeze({
  '20261110063101_init': '4C61E8FA141D6C0B06A4E6EEF86D3CA28585CF5F7253B72FFACFD6FE637CE62B',
  '20261110090354_message_status': 'DE1C7F227B27526C7EF4AA99461DDC1E0A75E89CBF9B3481BEFC78460703211D',
  '20261111160700_stage1_integrity': 'E7E064EDE5A811D3433DE417F35FBEC2C21782245876D2714BA9779A9B1A4945',
  '20261111161500_wp2_listing_states': '815CCCD1ABF2B8DBCAC4D7C23EABAA89274EA57F5EC33AFF04A45267105A4FB5',
  '20261116094000_pwa_push_notifications': '8DF53F073DC8FAA81D37F2D4ED8D8519214F45B2A406D27A3D2D2EE92F4C13CD',
  '20261116193000_wp3_transactions': 'F14FD1971E96BE0F42A4618415D4B94EFBD2D70AD5736D41784ADC14E3B133D5',
  '20261116220000_managed_student_content': '4D02DB939AEC4CE4B4A15E9938FF93D2B3ECB54BA50A137B03A94E1C8329AF5F',
  '20261116221000_pending_announcement_edits': '151EB0B58209D48985B7B713F6BD7A84C13059867009525406C2EE1995E53907',
});
export const EXPECTED_APPLIED: readonly string[] = Object.freeze(Object.keys(EXPECTED_MIGRATIONS).slice(0, 5));
export const EXPECTED_PENDING: readonly string[] = Object.freeze(Object.keys(EXPECTED_MIGRATIONS).slice(5));

export type MigrationOnDisk = { name: string; sha256: string };
export type AppliedMigration = {
  name: string;
  checksum: string;
  finished: boolean;
  rolledBack: boolean;
};
export type GateBInputs = {
  databaseUrl: string;
  nodeEnv: string | undefined;
  databaseName: string;
  diskMigrations: MigrationOnDisk[];
  applied: AppliedMigration[];
  databaseTables: string[];
  /** An independently verified, deliberate pause of all schema-writing agents. */
  coordinatedFreeze: boolean;
  /** Written and specific approval for just the local WP3 migration. */
  writtenGateBApproval: boolean;
  /** A NEW retained backup after maintenance starts, restored and verified independently. */
  freshBackupRestoreVerified: boolean;
};

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length &&
  a.slice().sort().join('|') === b.slice().sort().join('|');

export function assessGateB(input: GateBInputs) {
  const technical: string[] = [];
  const procedural: string[] = [];
  try {
    const url = new URL(input.databaseUrl);
    if (input.nodeEnv === 'production' ||
        url.protocol !== 'mysql:' || url.hostname !== '127.0.0.1' ||
        url.port !== '3306' || url.pathname !== '/cpsu_marketplace' ||
        url.search !== '' || url.hash !== '' ||
        input.databaseName !== 'cpsu_marketplace') {
      technical.push('wrong_database_or_production_mode');
    }
  } catch {
    technical.push('invalid_database_identity');
  }

  const expectedNames = Object.keys(EXPECTED_MIGRATIONS);
  const presentNames = input.diskMigrations.map(m => m.name);
  if (!same(presentNames, expectedNames) ||
      new Set(presentNames).size !== presentNames.length ||
      input.diskMigrations.some(m =>
        typeof EXPECTED_MIGRATIONS[m.name] !== 'string' ||
        EXPECTED_MIGRATIONS[m.name].toUpperCase() !== m.sha256.toUpperCase())) {
    technical.push('migration_inventory_or_checksum_mismatch');
  }
  const appliedNames = input.applied.map(m => m.name);
  if (!same(appliedNames, EXPECTED_APPLIED) ||
      new Set(appliedNames).size !== appliedNames.length ||
      input.applied.some(m => !m.finished || m.rolledBack ||
        typeof EXPECTED_MIGRATIONS[m.name] !== 'string' ||
        EXPECTED_MIGRATIONS[m.name].toUpperCase() !== m.checksum.toUpperCase())) {
    technical.push('applied_migration_history_not_at_approved_baseline');
  }
  const names = input.databaseTables.map(name => name.toLowerCase());
  if (!same(names, EXPECTED_TABLES) || new Set(names).size !== names.length)
    technical.push('unexpected_pre_wp3_table_catalog');

  if (!input.coordinatedFreeze) procedural.push('multi_agent_freeze_not_confirmed');
  if (!input.writtenGateBApproval) procedural.push('explicit_gate_b_approval_missing');
  if (!input.freshBackupRestoreVerified) procedural.push('fresh_restore_verified_backup_missing');

  return {
    technicalBaselinePass: technical.length === 0,
    deploymentAuthorized: technical.length === 0 && procedural.length === 0,
    blockers: [...technical, ...procedural],
    selected: [...EXPECTED_APPLIED, WP3_MIGRATION],
    outOfScope: EXPECTED_PENDING.slice(1),
  };
}
