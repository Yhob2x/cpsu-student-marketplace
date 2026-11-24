import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const load = readFileSync(new URL('./load.js', import.meta.url), 'utf8');
const writes = readFileSync(new URL('./writes.js', import.meta.url), 'utf8');
const probe = readFileSync(new URL('./target-probe.js', import.meta.url), 'utf8');
const starter = readFileSync(new URL('../apps/api/src/perf-start.ts', import.meta.url), 'utf8');

describe('production-like k6 staged load protection (offline only)', () => {
  test('both read/write workloads attest the actual isolated API first', () => {
    expect(load).toContain('export function setup()');
    expect(writes).toContain('export function setup()');
    expect(load).toContain('verifyTargetBeforeLoad(settings, __ENV)');
    expect(load).toContain('validateSyntheticAccountPools(fixtures.accounts, settings.profile.maxVus)');
    expect(load).toContain('syntheticAccountForVu(syntheticPools, __VU, role)');
    expect(writes).toContain('verifyTargetBeforeLoad(config, __ENV)');
    expect(probe).toContain("'/__perf/identity'");
    expect(probe).toContain("'X-CPSU-Perf-Token'");
    expect(probe).toContain('assertIsolatedApiAttestation(data, env.PERF_DB_NAME)');
  });

  test('load harness measures paged PWA paths, not legacy unbounded views', () => {
    expect(load).toContain("'/api/v1/inquiries?limit=30'");
    expect(load).toContain("'/messages?limit=50'");
    expect(load).toContain("'?limit=24'");
    expect(load).toContain("'p(95)<300'");
    expect(writes).toContain("'p(95)<500'");
  });

  test('only the isolated API entrypoint exposes the loopback attestation', () => {
    expect(starter).toContain("app.get('/__perf/identity'");
    expect(starter).toContain('verifyPerfDatabase(target.dbName,');
    expect(starter).toContain('perfMigrationApprovalProblems(approval, migrations)');
    expect(starter).toContain('appliedPerfMigrationProblems(applied, migrations)');
    expect(starter.indexOf('perfMigrationApprovalProblems(approval, migrations)'))
      .toBeLessThan(starter.indexOf('verifyPerfDatabase(target.dbName,'));
    expect(starter).toContain('count({ where: { NOT: { email: { endsWith:');
    expect(starter).toContain('target.bindHost');
  });
});
