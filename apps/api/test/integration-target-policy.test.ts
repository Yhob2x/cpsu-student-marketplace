import { describe, expect, test } from 'bun:test';
import { checkIntegrationSource, checkIntegrationTarget } from '../src/integration-target-policy.js';

const local = 'mysql://qa:synthetic@127.0.0.1:3306/cpsu_marketplace';
const migrated = ['20261110063101_init', '20261118120000_managed_home_page_content'];

describe('read-only integration source policy (no database connection)', () => {
  test('accepts only the specifically approved local source format', () => {
    expect(checkIntegrationSource(local, 'development')).toEqual([]);
    expect(checkIntegrationSource(local, 'production')).toContain('Production mode is not permitted.');
  });

  test.each([
    ['remote server', 'mysql://qa:synthetic@192.0.2.10:3306/cpsu_marketplace'],
    ['development replacement', 'mysql://qa:synthetic@127.0.0.1:3306/cpsu_marketplace_test'],
    ['unexpected port', 'mysql://qa:synthetic@127.0.0.1:3307/cpsu_marketplace'],
    ['unsupported protocol', 'postgresql://qa:synthetic@127.0.0.1:3306/cpsu_marketplace'],
    ['URL parameters', local + '?sslaccept=accept_invalid_certs'],
    ['no user', 'mysql://127.0.0.1:3306/cpsu_marketplace'],
    ['malformed URL', 'not-a-database-url'],
  ])('refuses %s before checking MySQL', (_name, url) => {
    expect(checkIntegrationSource(url, 'test').length).toBeGreaterThan(0);
  });
});

describe('integration schema and migration inventory policy (no database connection)', () => {
  const clean = {
    exists: true,
    dataRows: 0,
    migrationDirectories: migrated,
    migrations: migrated.map(name => ({ name, complete: true })),
  };

  test('allows exactly empty and migration-current synthetic schemas', () => {
    expect(checkIntegrationTarget(clean)).toEqual([]);
  });
  test('missing target cannot be implicitly created during a dry run', () => {
    expect(checkIntegrationTarget({ ...clean, exists: false }).join(' ')).toContain('does not exist');
  });
  test('refuses any existing non-migration row, even in the allowlisted test schema', () => {
    expect(checkIntegrationTarget({ ...clean, dataRows: 1n }).join(' ')).toContain('contains data');
  });
  test('does not silently apply a newly introduced migration', () => {
    const expected = [...migrated, '20261118160000_store_reviews'];
    const problems = checkIntegrationTarget({ ...clean, migrationDirectories: expected });
    expect(problems).toEqual(['Pending migration requiring separate review: 20261118160000_store_reviews']);
  });
  test('incomplete, duplicate or unexpected migration records always block', () => {
    const problems = checkIntegrationTarget({ ...clean, migrations: [
      { name: migrated[0], complete: false },
      { name: migrated[0], complete: true },
      { name: 'unreviewed', complete: true },
    ] });
    expect(problems.some(message => message.startsWith('Incomplete'))).toBe(true);
    expect(problems.some(message => message.startsWith('Duplicate'))).toBe(true);
    expect(problems.some(message => message.startsWith('Unexpected'))).toBe(true);
    expect(problems.some(message => message.startsWith('Pending'))).toBe(true);
  });
});
