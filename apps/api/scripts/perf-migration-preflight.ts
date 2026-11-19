/** Offline, read-only approval gate. No DB calls, migrations or test traffic.
 * bun scripts/perf-migration-preflight.ts --audit-only
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspectMigrationFiles, perfMigrationApprovalProblems } from '../src/perf-migration-policy.js';

if (process.argv.slice(2).join(' ') !== '--audit-only') {
  console.error('Only --audit-only is permitted');
  process.exit(2);
}
const apiRoot = join(import.meta.dir, '..');
const projectRoot = join(apiRoot, '..', '..');
const migrations = inspectMigrationFiles(join(apiRoot, 'prisma', 'migrations'));
const manifestPath = join(projectRoot, 'performance', 'perf-approval.local.json');
console.log('PERFORMANCE STAGING APPROVAL CHECK (OFFLINE; NO DATABASE)');
console.log('Migration directories: ' + migrations.length);
for (const item of migrations) console.log(item.name + ' SHA256 ' + item.sha256);
let approval = null;
if (existsSync(manifestPath)) {
  try { approval = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { console.error('STOP: Private approval record is not valid JSON'); process.exit(1); }
}
const problems = perfMigrationApprovalProblems(approval, migrations);
if (problems.length) {
  problems.forEach(issue => console.error('STOP: ' + issue));
  console.error('BLOCKED: no staging environment, migrations or load tests authorized by this preflight');
  process.exitCode = 1;
} else console.log('Source migration manifest matches private reviewed approval. This does not authorize deployment or verify applied database migrations.');
