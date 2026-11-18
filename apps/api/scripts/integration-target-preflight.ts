/**
 * READ-ONLY verification of the local test schema before any synthetic fixture reset.
 * Run from apps/api: bun scripts/integration-target-preflight.ts --audit-only
 * No CREATE, ALTER, DROP, INSERT, UPDATE or DELETE operation occurs here.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { checkIntegrationSource, checkIntegrationTarget, INTEGRATION_TEST_DB } from '../src/integration-target-policy.js';

if (process.argv.slice(2).join(' ') !== '--audit-only') {
  throw new Error('Only an explicit --audit-only invocation is supported.');
}
const source = process.env.DATABASE_URL;
const sourceIssues = checkIntegrationSource(source, process.env.NODE_ENV);
if (sourceIssues.length) {
  for (const issue of sourceIssues) console.error('STOP: ' + issue);
  process.exit(1);
}
// Restrict the source to information_schema checks; never query its student tables.
const url = new URL(source!);
const dbUrl = new URL(source!);
dbUrl.pathname = '/' + INTEGRATION_TEST_DB;
const migrationsDir = join(import.meta.dir, '..', 'prisma', 'migrations');
const directories = readdirSync(migrationsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(migrationsDir, entry.name, 'migration.sql')))
  .map(entry => entry.name).sort();
const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
let target: PrismaClient | null = null;
try {
  const existing = await admin.$queryRawUnsafe<{ name: string }[]>(
    'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
    INTEGRATION_TEST_DB,
  );
  if (existing.length === 0) {
    console.error('STOP: ' + INTEGRATION_TEST_DB + ' does not exist. No schema was created.');
    process.exitCode = 1;
  } else {
    target = new PrismaClient({ datasources: { db: { url: dbUrl.toString() } } });
    const active = await target.$queryRawUnsafe<{ name: string }[]>('SELECT DATABASE() AS name');
    if (active[0]?.name !== INTEGRATION_TEST_DB) throw new Error('STOP: unexpected database selected.');
    const tables = await target.$queryRawUnsafe<{ name: string }[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'",
    );
    let rows = 0n;
    for (const { name } of tables) {
      if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw new Error('STOP: unexpected test table identifier.');
      if (name.toLowerCase() === '_prisma_migrations') continue;
      const count = await target.$queryRawUnsafe<{ n: bigint }[]>(
        'SELECT COUNT(*) AS n FROM `' + name + '`',
      );
      rows += BigInt(count[0]?.n ?? 0);
    }
    const historyExists = tables.some(item => item.name.toLowerCase() === '_prisma_migrations');
    const history = historyExists ? await target.$queryRawUnsafe<{ name: string; complete: number }[]>(
      'SELECT migration_name AS name, (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS complete FROM `_prisma_migrations`',
    ) : [];
    const issues = checkIntegrationTarget({
      exists: true,
      dataRows: rows,
      migrations: history.map(item => ({ name: item.name, complete: Boolean(item.complete) })),
      migrationDirectories: directories,
    });
    console.log('LOCAL INTEGRATION PREFLIGHT (READ-ONLY)');
    console.log('Target: ' + INTEGRATION_TEST_DB + ' on localhost:3306');
    console.log('Test schema tables: ' + tables.length + '; non-migration rows: ' + rows);
    console.log('Migration directories: ' + directories.length + '; complete test migration records: ' + history.filter(h => h.complete).length);
    if (issues.length) {
      for (const issue of issues) console.error('STOP: ' + issue);
      console.error('BLOCKED: Do not execute test:integration or allow fixture reset until separately reviewed.');
      process.exitCode = 1;
    } else {
      console.log('PASS: Target is empty and matches all checked-in migrations. No data or schema changed.');
    }
  }
} finally {
  await target?.$disconnect();
  await admin.$disconnect();
}
