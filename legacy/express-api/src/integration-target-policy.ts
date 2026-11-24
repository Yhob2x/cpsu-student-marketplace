/** Pure, network-free validation of a local synthetic MySQL integration target. */
export const INTEGRATION_SOURCE_DB = 'cpsu_marketplace';
export const INTEGRATION_TEST_DB = 'cpsu_marketplace_test';

export function checkIntegrationSource(url: string | undefined, nodeEnv: string | undefined): string[] {
  const problems: string[] = [];
  if (nodeEnv === 'production') problems.push('Production mode is not permitted.');
  let source: URL;
  try { source = new URL(url ?? ''); }
  catch { return [...problems, 'A valid database connection is required.']; }
  if (source.protocol !== 'mysql:' || source.hostname !== '127.0.0.1' ||
      source.port !== '3306' || source.pathname !== '/' + INTEGRATION_SOURCE_DB ||
      source.search || source.hash) {
    problems.push('Expected only 127.0.0.1:3306/' + INTEGRATION_SOURCE_DB + ' with no URL parameters.');
  }
  if (!source.username || !source.password) problems.push('The local test connection lacks credentials.');
  return problems;
}

export type MigrationRecord = { name: string; complete: boolean };
export function checkIntegrationTarget(input: {
  exists: boolean;
  dataRows: bigint | number;
  migrations: MigrationRecord[];
  migrationDirectories: string[];
}): string[] {
  const issues: string[] = [];
  if (!input.exists) return ['Isolated test database does not exist; provisioning is a separately approved operation.'];
  if (BigInt(input.dataRows) !== 0n) issues.push('The test database contains data; automated fixture cleanup is prohibited.');
  const applied = new Map<string, boolean>();
  for (const m of input.migrations) {
    if (applied.has(m.name)) issues.push('Duplicate migration record: ' + m.name);
    applied.set(m.name, m.complete);
    if (!m.complete) issues.push('Incomplete or rolled-back migration: ' + m.name);
  }
  const expected = new Set(input.migrationDirectories);
  for (const name of expected) if (!applied.has(name)) issues.push('Pending migration requiring separate review: ' + name);
  for (const name of applied.keys()) if (!expected.has(name)) issues.push('Unexpected migration record: ' + name);
  return issues;
}
