import { describe, expect, test } from 'bun:test';
import { chooseJourney, TRAFFIC, validateConfig, PROFILES, pickByVu } from './config.js';
const good = {
  PERF_ISOLATED: 'I_CONFIRM_SYNTHETIC_ONLY',
  PERF_DB_NAME: 'cpsu_marketplace_test',
  PERF_DB_VERIFIED: 'I_CHECKED_API_DATABASE_TARGET',
  PERF_BASE_URL: 'http://127.0.0.1:4400',
};
describe('load generator safety gates', () => {
  test('requires isolation and verified DB target', () => {
    expect(() => validateConfig({})).toThrow();
    expect(() => validateConfig({ ...good, PERF_DB_NAME: 'cpsu_marketplace' })).toThrow();
    expect(validateConfig(good).profileName).toBe('smoke');
  });
  test('refuses real campus network targets', () => {
    expect(() => validateConfig({ ...good, PERF_BASE_URL: 'https://cpsu.edu.ph', PERF_STAGING_APPROVED: 'YES', PERF_APPROVED_HOST: 'cpsu.edu.ph' })).toThrow();
    expect(() => validateConfig({ ...good, PERF_BASE_URL: 'https://x.example.com' })).toThrow();
  });
  test('higher stages require separate approval', () => {
    expect(() => validateConfig({ ...good, PERF_PROFILE: 'normal' })).toThrow();
    expect(validateConfig({ ...good, PERF_PROFILE: 'normal', PERF_STAGING_APPROVED: 'YES', PERF_APPROVED_STAGE: 'normal' }).profile.maxVus).toBe(300);
    expect(() => validateConfig({ ...good, PERF_PROFILE: 'busy', PERF_STAGING_APPROVED: 'YES', PERF_APPROVED_STAGE: 'busy' })).toThrow();
  });
  test('writes must have opt-in approval', () => {
    expect(() => validateConfig({ ...good, PERF_ENABLE_WRITES: 'YES' })).toThrow();
    expect(validateConfig({ ...good, PERF_ENABLE_WRITES: 'YES', PERF_APPROVED_WRITES: 'I_APPROVE_SYNTHETIC_MUTATIONS' }).profileName).toBe('smoke');
  });
});
describe('workload and fixtures', () => {
  test('weighted distribution sums to 100', () => {
    expect(TRAFFIC.reduce((sum, x) => sum + x.weight, 0)).toBe(100);
    expect(chooseJourney(0)).toBe('home');
    expect(chooseJourney(0.26)).toBe('explore');
    expect(chooseJourney(0.9999)).toBe('notifications');
  });
  test('VU selection and maximum profile are deterministic', () => {
    expect(pickByVu(['a', 'b'], 3)).toBe('a');
    expect(PROFILES.maximum.maxVus).toBe(15000);
  });
});
