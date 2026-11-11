/**
 * Retained, local-only pre-migration development backup.
 * Run from apps/api with NODE_ENV != production.
 * Backup contains student data. Keep it private and do not check it into Git.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, copyFileSync, readdirSync, statSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
const u = new URL(process.env.DATABASE_URL ?? '');
const database = decodeURIComponent(u.pathname.replace(/^\//,''));
if (process.argv[2] !== '--development-backup' || process.env.NODE_ENV === 'production' ||
  database !== 'cpsu_marketplace' || !['127.0.0.1','localhost','::1'].includes(u.hostname))
  throw new Error('Only the local development database may be backed up by this command.');
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const root = join(homedir(), 'AppData', 'Local', 'CPSU-Marketplace', 'backups', stamp);
if (existsSync(root)) throw new Error('Unexpected duplicate backup folder.');
mkdirSync(root, { recursive: true, mode: 0o700 });
const filename = join(root, 'cpsu_marketplace.sql');
const fd = openSync(filename, 'wx', 0o600);
const result = spawnSync('C:\\xampp\\mysql\\bin\\mysqldump.exe', [
  '--protocol=TCP', '--host=' + u.hostname, '--port=' + (u.port || '3306'),
  '--user=' + decodeURIComponent(u.username), '--single-transaction', '--quick', '--hex-blob',
  '--skip-add-drop-table', '--default-character-set=utf8mb4',
  '--routines', '--triggers', '--events', database,
], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(u.password) },
     stdio: ['ignore', fd, 'pipe'], windowsHide: true });
closeSync(fd);
if (result.error || result.status !== 0) throw new Error('Database backup failed. Do not migrate. File needs inspection.');
const data = Bun.file(filename);
const bytes = statSync(filename).size;
if (bytes < 1000) throw new Error('Backup unexpectedly small. Do not migrate.');
const digest = createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex');
const uploads = resolve(process.env.UPLOAD_DIR ?? './uploads');
let files = 0;
if (existsSync(uploads)) {
  const destination = join(root, 'uploads');
  cpSync(uploads, destination, { recursive: true, force: false });
  const walk = (dir: string): number => readdirSync(dir, { withFileTypes: true })
    .reduce((n, f) => n + (f.isDirectory() ? walk(join(dir, f.name)) : 1), 0);
  files = walk(destination);
}
writeFileSync(join(root, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(), database, backupFilename: 'cpsu_marketplace.sql',
  sqlBytes: bytes, sqlSha256: digest, uploadFileCount: files,
  note: 'Sensitive database records. Access only as project owner; do not publish or commit.',
}, null, 2));
console.log('Backup location: ' + root);
console.log('SQL bytes: ' + bytes + '; SHA-256: ' + digest.slice(0,16) + '…; photo files: ' + files);
console.log('Backed up locally. This is NOT a production backup.');
