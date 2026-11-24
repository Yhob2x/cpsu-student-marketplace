/** Dedicated performance API entrypoint. NEVER use for development or production.
 * Fails closed before listen unless connected to a synthetic-only local DB.
 * Run only after CPSU staging migration, privacy and test scope approvals.
 */
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import './env.js'; // Validate production-like environment before doing any DB I/O.
import { prisma } from './db.js';
import { createApp } from './app.js';
import { createShutdown } from './graceful-shutdown.js';
import { validatePerfApiEnvironment, verifyPerfDatabase } from './perf-isolation.js';
import { inspectMigrationFiles, perfMigrationApprovalProblems,
  appliedPerfMigrationProblems, type AppliedMigration } from './perf-migration-policy.js';

function matchesProbeToken(provided: string | undefined, expected: string) {
  if (!provided) return false;
  const supplied = Buffer.from(provided, 'utf8');
  const reference = Buffer.from(expected, 'utf8');
  if (supplied.length !== reference.length) return false;
  return timingSafeEqual(supplied, reference);
}

async function start() {
  // Gate 1: independent private approval must match EVERY source migration byte.
  // An unreviewed new migration, absent approval file or uncommitted SQL change
  // fails before a database connection or listening socket can be created.
  const target = validatePerfApiEnvironment(process.env);
  // This guarded entrypoint is launched from source, not from the compiled API bundle.
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  const migrations = inspectMigrationFiles(join(sourceDir, '..', 'prisma', 'migrations'));
  const approvalPath = join(sourceDir, '..', '..', '..', 'performance', 'perf-approval.local.json');
  const approval = JSON.parse(readFileSync(approvalPath, 'utf8'));
  const approvalIssues = perfMigrationApprovalProblems(approval, migrations);
  if (approvalIssues.length) throw new Error('Private synthetic performance migration approval did not pass');

  // Gate 2: the selected DB, synthetic-account inventory and *applied* Prisma
  // migration history must match before any port opens. These checks are SELECT-only.
  const attestation = await verifyPerfDatabase(target.dbName,
    async () => {
      const rows = await prisma.$queryRaw<Array<{ selected_db: string | null }>>`SELECT DATABASE() AS selected_db`;
      return rows[0]?.selected_db ?? null;
    },
    async () => prisma.user.count({ where: { NOT: { email: { endsWith: '.test' } } } }),
  );
  const applied = await prisma.$queryRaw<AppliedMigration[]>`
    SELECT migration_name, checksum, finished_at, rolled_back_at
    FROM _prisma_migrations`;
  if (appliedPerfMigrationProblems(applied, migrations).length)
    throw new Error('Actual applied migrations do not match reviewed synthetic source');

  const app = express();
  app.disable('x-powered-by');
  // The probe is available on the *isolated* loopback-only entrypoint only.
  // Normal API deployments have no such route. Never proxy it publicly.
  app.get('/__perf/identity', (req, res) => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') ||
        !matchesProbeToken(req.get('x-cpsu-perf-token'), process.env.PERF_TARGET_TOKEN!))
      return res.status(404).end();
    res.setHeader('Cache-Control', 'no-store');
    return res.json(attestation);
  });
  app.use(createApp());
  const server = app.listen(target.port, target.bindHost, () =>
    console.info('Isolated synthetic performance API listening on loopback port 4401'));
  const shutdown = createShutdown(server, () => prisma.$disconnect());
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

try { await start(); }
catch {
  console.error('Isolated performance API blocked: configuration or database safety check failed.');
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
}
