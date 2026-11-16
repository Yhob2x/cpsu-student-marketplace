import { test, expect } from 'bun:test';
import {
  assessGateB, EXPECTED_MIGRATIONS, EXPECTED_APPLIED, EXPECTED_PENDING,
  type GateBInputs,
} from '../scripts/wp3-gate-b-readonly-policy.js';
import { EXPECTED_TABLES } from '../scripts/wp3-restore-safety.js';

const good = (): GateBInputs => ({
  databaseUrl: 'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace',
  nodeEnv: 'development',
  databaseName: 'cpsu_marketplace',
  diskMigrations: Object.entries(EXPECTED_MIGRATIONS).map(([name, sha256]) => ({ name, sha256 })),
  applied: EXPECTED_APPLIED.map(name => ({
    name, checksum: EXPECTED_MIGRATIONS[name], finished: true, rolledBack: false,
  })),
  databaseTables: [...EXPECTED_TABLES],
  coordinatedFreeze: false,
  writtenGateBApproval: false,
  freshBackupRestoreVerified: false,
});

test('Gate B preflight recognizes approved source chain but NEVER mistakes continue for authorization', () => {
  const outcome = assessGateB(good());
  expect(outcome.technicalBaselinePass).toBe(true);
  expect(outcome.deploymentAuthorized).toBe(false);
  expect(outcome.selected).toEqual([...EXPECTED_APPLIED, EXPECTED_PENDING[0]]);
  expect(outcome.outOfScope).toEqual(EXPECTED_PENDING.slice(1));
  expect(outcome.blockers).toContain('multi_agent_freeze_not_confirmed');
  expect(outcome.blockers).toContain('explicit_gate_b_approval_missing');
  expect(outcome.blockers).toContain('fresh_restore_verified_backup_missing');
});

test('Gate B rejects remote, alternate port/schema, and production', () => {
  for (const url of [
    'mysql://example:secret@private.example:3306/cpsu_marketplace',
    'mysql://example:secret@127.0.0.1:3307/cpsu_marketplace',
    'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace_test',
    'mysql://example:secret@localhost:3306/cpsu_marketplace',
    'mysql://example:secret@127.0.0.1:3306/cpsu_marketplace?sslaccept=accept_invalid_certs',
  ]) {
    expect(assessGateB({ ...good(), databaseUrl: url }).technicalBaselinePass).toBe(false);
  }
  expect(assessGateB({ ...good(), nodeEnv: 'production' }).technicalBaselinePass).toBe(false);
  expect(assessGateB({ ...good(), databaseName: 'other_database' }).technicalBaselinePass).toBe(false);
});

test('Gate B rejects tampering, changes and extra migration directories', () => {
  const one = good();
  one.diskMigrations[5].sha256 = '0'.repeat(64);
  expect(assessGateB(one).blockers).toContain('migration_inventory_or_checksum_mismatch');
  const two = good();
  two.diskMigrations.push({name:'20261116230000_unknown', sha256:'0'.repeat(64)});
  expect(assessGateB(two).technicalBaselinePass).toBe(false);
  const three = good();
  three.diskMigrations.pop();
  expect(assessGateB(three).technicalBaselinePass).toBe(false);
  const four = good();
  four.diskMigrations[0].name = four.diskMigrations[1].name;
  expect(assessGateB(four).technicalBaselinePass).toBe(false);
});

test('Gate B refuses incomplete/rolled-back/checksum-drifted/applied WP3 history', () => {
  const incomplete = good();
  incomplete.applied[1].finished = false;
  expect(assessGateB(incomplete).technicalBaselinePass).toBe(false);
  const badHash = good();
  badHash.applied[1].checksum = 'BAD';
  expect(assessGateB(badHash).technicalBaselinePass).toBe(false);
  const rolled = good();
  rolled.applied[0].rolledBack = true;
  expect(assessGateB(rolled).technicalBaselinePass).toBe(false);
  const appliedWp3 = good();
  appliedWp3.applied.push({name:EXPECTED_PENDING[0],checksum:EXPECTED_MIGRATIONS[EXPECTED_PENDING[0]],finished:true,rolledBack:false});
  expect(assessGateB(appliedWp3).technicalBaselinePass).toBe(false);
  const missing = good();
  missing.applied.pop();
  expect(assessGateB(missing).technicalBaselinePass).toBe(false);
});

test('Gate B blocks unexpected tables and requires ALL distinct approvals in test fixture', () => {
  expect(assessGateB({ ...good(), databaseTables: ['user'] }).technicalBaselinePass).toBe(false);
  const withConsent = { ...good(), coordinatedFreeze: true, writtenGateBApproval: true };
  expect(assessGateB(withConsent).deploymentAuthorized).toBe(false);
  expect(assessGateB({...withConsent, freshBackupRestoreVerified:true}).deploymentAuthorized).toBe(true);
});
