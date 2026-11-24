/**
 * Create a RETAINED local MySQL development backup outside the repository.
 * Run only from apps/api: bun scripts/create-local-backup.ts --development
 * Does not alter the database or change credentials.
 */
import { PrismaClient } from '@prisma/client';
import { mkdirSync, openSync, closeSync, statSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

if (process.argv.length !== 3 || process.argv[2] !== '--development' || process.env.NODE_ENV === 'production') {
  throw new Error('Local development backup requires --development outside production.');
}
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error('DATABASE_URL is missing.');
const u = new URL(raw);
if (!['127.0.0.1', 'localhost', '::1'].includes(u.hostname) ||
    decodeURIComponent(u.pathname.replace(/^\//, '')) !== 'cpsu_marketplace') {
  throw new Error('Only the local CPSU development database may be backed up here.');
}
const home = process.env.USERPROFILE;
if (!home) throw new Error('Could not resolve Windows user profile.');
const dir = join(home, 'Documents', 'CPSU-Marketplace-Backups');
mkdirSync(dir, { recursive: true });
const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..*/, 'Z');
const output = join(dir, 'cpsu_marketplace_' + stamp + '.sql');
const fd = openSync(output, 'wx', 0o600);
const mysqlDump = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
try {
  const proc = spawnSync(mysqlDump, [
    '--protocol=TCP', '--host=' + u.hostname, '--port=' + (u.port || '3306'),
    '--user=' + decodeURIComponent(u.username), '--single-transaction', '--quick', '--hex-blob',
    '--skip-add-drop-table', '--default-character-set=utf8mb4',
    '--routines', '--triggers', '--events', 'cpsu_marketplace',
  ], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) },
       stdio: ['ignore', fd, 'pipe'], windowsHide: true, timeout: 120000 });
  if (proc.error || proc.status !== 0) throw new Error('mysqldump failed. Check MariaDB permissions.');
} catch (e) {
  closeSync(fd); rmSync(output, { force: true }); throw e;
}
closeSync(fd);
const bytes = statSync(output).size;
const dump = readFileSync(output);
const sql = dump.toString('utf8');
if (bytes < 1000 || !sql.includes('CREATE TABLE') ||
    /(?:^|\n)\s*(DROP DATABASE|CREATE DATABASE|USE)\s/mi.test(sql)) {
  rmSync(output, { force: true });
  throw new Error('Backup format verification failed; incomplete dump deleted.');
}
const sha256 = createHash('sha256').update(dump).digest('hex');
writeFileSync(output + '.sha256', sha256 + '  ' + output.split(/[\\/]/).pop() + '\n', { flag: 'wx' });
console.log('RETAINED BACKUP CREATED (local development snapshot only)');
console.log('Location: ' + output);
console.log('Bytes: ' + bytes);
console.log('SHA-256: ' + sha256);
console.log('Contains student/account data: keep private. Never commit or share.');
console.log('Not a pre-migration backup if the migration was already applied.');
