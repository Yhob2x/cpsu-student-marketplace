import { describe, expect, test } from 'bun:test';
import { validatePerfApiEnvironment, verifyPerfDatabase } from '../src/perf-isolation.js';

const safe = {
  PERF_ISOLATED: 'I_CONFIRM_SYNTHETIC_ONLY',
  PERF_DB_VERIFIED: 'I_CHECKED_API_DATABASE_TARGET',
  PERF_DB_NAME: 'cpsu_marketplace_perf',
  DATABASE_URL: 'mysql://synthetic:synthetic@127.0.0.1:3306/cpsu_marketplace_perf',
  NODE_ENV: 'production', BIND_HOST: '127.0.0.1', PORT: '4401', COOKIE_SECURE: 'true',
  PUSH_SUBSCRIPTIONS_ENABLED: 'false', PUSH_DELIVERY_ENABLED: 'false',
  STUDENT_ID_COLLECTION_ENABLED: 'false', MEDIA_STORAGE: 'local',
  UPLOAD_DIR: 'C:/synthetic-work/.tmp/perf-uploads',
  CORS_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  PERF_TARGET_TOKEN: 'synthetic-only-not-a-real-token-1234567890',
};

describe('isolated performance API startup is fail closed', () => {
  test('valid synthetic-only loopback configuration is recognized without connecting to DB', () => {
    expect(validatePerfApiEnvironment(safe)).toEqual({
      dbName: 'cpsu_marketplace_perf', port: 4401, bindHost: '127.0.0.1',
    });
  });

  test.each([
    ['live development DB URL', { DATABASE_URL: 'mysql://synthetic:synthetic@127.0.0.1:3306/cpsu_marketplace' }],
    ['live DB name', { PERF_DB_NAME: 'cpsu_marketplace', DATABASE_URL: 'mysql://synthetic:synthetic@127.0.0.1:3306/cpsu_marketplace' }],
    ['remote DB', { DATABASE_URL: 'mysql://synthetic:synthetic@192.0.2.10:3306/cpsu_marketplace_perf' }],
    ['non-loopback API', { BIND_HOST: '0.0.0.0' }],
    ['ordinary development API port', { PORT: '4000' }],
    ['unsecured cookies', { COOKIE_SECURE: 'false' }],
    ['development-mode process', { NODE_ENV: 'development' }],
    ['push subscriptions enabled', { PUSH_SUBSCRIPTIONS_ENABLED: 'true' }],
    ['push delivery enabled', { PUSH_DELIVERY_ENABLED: 'true' }],
    ['student ID collection enabled', { STUDENT_ID_COLLECTION_ENABLED: 'true' }],
    ['external media storage', { MEDIA_STORAGE: 'google_drive' }],
    ['real upload folder', { UPLOAD_DIR: 'C:/synthetic-work/apps/api/uploads' }],
    ['relative upload folder', { UPLOAD_DIR: '.tmp/perf-uploads' }],
    ['campus CORS', { CORS_ORIGINS: 'https://cpsu.edu.ph' }],
    ['missing token', { PERF_TARGET_TOKEN: '' }],
    ['missing database confirmation', { PERF_DB_VERIFIED: '' }],
    ['URL pointing to another schema', { DATABASE_URL: 'mysql://synthetic:synthetic@127.0.0.1:3306/cpsu_marketplace_test' }],
  ])('refuses %s', (_name, overrides) => {
    expect(() => validatePerfApiEnvironment({ ...safe, ...overrides })).toThrow();
  });

  test('only connected DB identity + aggregate synthetic account check permits startup', async () => {
    const actions: string[] = [];
    const valid = await verifyPerfDatabase('cpsu_marketplace_perf', async () => {
      actions.push('actual_schema'); return 'cpsu_marketplace_perf';
    }, async () => { actions.push('email_aggregate'); return 0; });
    expect(valid).toEqual({ database: 'cpsu_marketplace_perf', isolated: true });
    expect(actions).toEqual(['actual_schema', 'email_aggregate']);
  });

  test('mismatch refuses service before scanning users, non-synthetic account count refuses startup', async () => {
    let counted = false;
    await expect(verifyPerfDatabase('cpsu_marketplace_perf',
      async () => 'cpsu_marketplace', async () => { counted = true; return 0; })).rejects.toThrow();
    expect(counted).toBe(false);
    await expect(verifyPerfDatabase('cpsu_marketplace_perf',
      async () => 'cpsu_marketplace_perf', async () => 1)).rejects.toThrow();
    await expect(verifyPerfDatabase('cpsu_marketplace_perf',
      async () => 'cpsu_marketplace_perf', async () => NaN)).rejects.toThrow();
  });
});
