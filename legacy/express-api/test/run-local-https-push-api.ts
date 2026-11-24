/**
 * Explicitly loopback-only QA API for local HTTPS PWA.
 *
 * Start from apps/api:
 *   $env:CPSU_PWA_HTTPS_QA='1'; bun test/run-local-https-push-api.ts
 *
 * Never starts with production mode or a remote database. Uses isolated push TEST
 * schema and NODE_ENV=test so outbound push delivery is intentionally suppressed.
 * Never logs credentials or VAPID values.
 */
const originalUrl = new URL(process.env.DATABASE_URL ?? '');
if (process.env.CPSU_PWA_HTTPS_QA !== '1' || process.env.NODE_ENV === 'production' ||
    !['localhost','127.0.0.1','::1'].includes(originalUrl.hostname) ||
    decodeURIComponent(originalUrl.pathname.slice(1)) !== 'cpsu_marketplace') {
  throw new Error('Refusing HTTPS QA outside the explicitly approved local CPSU development environment.');
}
const isolated = new URL(originalUrl.href);
isolated.pathname = '/cpsu_marketplace_push_test';
process.env.DATABASE_URL = isolated.href;
process.env.NODE_ENV = 'test';
process.env.PORT = '4400';
process.env.COOKIE_SECURE = 'true';
process.env.CORS_ORIGINS = 'https://localhost:8443';

const { createApp } = await import('../src/app.js');
createApp().listen(4400, '127.0.0.1', () => {
  console.log('CPSU HTTPS QA API bound to 127.0.0.1:4400, isolated test schema, outbound push suppressed.');
});
