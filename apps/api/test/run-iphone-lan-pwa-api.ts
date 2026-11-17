/**
 * iPhone LAN PWA QA API: only existing isolated test DB, never cpsu_marketplace.
 * No DB migrations, real pushes, public binds, or credentials printed.
 */
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';

const source = new URL(process.env.DATABASE_URL ?? '');
const ip = process.env.CPSU_IPHONE_LAN_IP ?? '';
const isLocalIp = Object.values(networkInterfaces()).flat().some(n =>
  n && n.family === 'IPv4' && !n.internal && n.address === ip && n.netmask === '255.255.255.0');
if (process.env.CPSU_IPHONE_LAN_QA !== '1' ||
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '::1'].includes(source.hostname) ||
    decodeURIComponent(source.pathname.slice(1)) !== 'cpsu_marketplace' ||
    !/^192\.168\.(?:\d{1,3})\.(?:\d{1,3})$/.test(ip) || !isLocalIp) {
  throw new Error('Refusing iPhone LAN QA without local source DB and private Wi-Fi network.');
}

const isolated = new URL(source.href);
isolated.pathname = '/cpsu_marketplace_push_test';
process.env.DATABASE_URL = isolated.href;
process.env.NODE_ENV = 'test';
process.env.PORT = '4400';
process.env.BIND_HOST = '127.0.0.1';
process.env.COOKIE_SECURE = 'true';
process.env.CORS_ORIGINS = 'https://' + ip + ':8445';
// Synthetic iPhone QA must NEVER inherit development Google Drive storage,
// real image-upload directories or outbound push delivery credentials.
process.env.MEDIA_STORAGE = 'local';
process.env.UPLOAD_DIR = join(tmpdir(), 'cpsu-marketplace-iphone-qa-uploads');
for (const key of ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_DRIVE_FOLDER_ID']) process.env[key] = '';
process.env.PUSH_SUBSCRIPTIONS_ENABLED = 'false';
process.env.PUSH_DELIVERY_ENABLED = 'false';

const { createApp } = await import('../src/app.js');
createApp().listen(4400, '127.0.0.1', () => {
  console.log('CPSU LAN iPhone QA API ready: 127.0.0.1:4400, isolated test DB, push disabled.');
});
