// CPSU Market k6 safety and workload configuration. No network I/O in this module.
export const TRAFFIC = Object.freeze([
  { name: 'home', weight: 25 },
  { name: 'explore', weight: 25 },
  { name: 'details', weight: 20 },
  { name: 'messaging', weight: 10 },
  { name: 'seller', weight: 8 },
  { name: 'social', weight: 5 },
  { name: 'transactions', weight: 5 },
  { name: 'notifications', weight: 2 },
]);

// Engineering profiles, not predictions of university concurrency.
// Only the small smoke/baseline profile may be run without stage-specific authorization.
export const PROFILES = Object.freeze({
  smoke: { maxVus: 1, stages: [{ duration: '10s', target: 1 }, { duration: '5s', target: 0 }] },
  baseline: { maxVus: 10, stages: [
    { duration: '30s', target: 3 }, { duration: '1m', target: 10 },
    { duration: '2m', target: 10 }, { duration: '30s', target: 0 },
  ] },
  normal: { maxVus: 300, stages: [
    { duration: '3m', target: 50 }, { duration: '5m', target: 150 },
    { duration: '5m', target: 300 }, { duration: '5m', target: 300 },
    { duration: '3m', target: 0 },
  ] },
  busy: { maxVus: 750, stages: [
    { duration: '5m', target: 300 }, { duration: '5m', target: 750 },
    { duration: '10m', target: 750 }, { duration: '5m', target: 0 },
  ] },
  peak: { maxVus: 1500, stages: [
    { duration: '10m', target: 750 }, { duration: '10m', target: 1500 },
    { duration: '10m', target: 1500 }, { duration: '5m', target: 0 },
  ] },
  stress: { maxVus: 3000, stages: [
    { duration: '10m', target: 1500 }, { duration: '10m', target: 3000 },
    { duration: '5m', target: 3000 }, { duration: '10m', target: 0 },
  ] },
  maximum: { maxVus: 15000, stages: [
    { duration: '15m', target: 3000 }, { duration: '20m', target: 7500 },
    { duration: '20m', target: 15000 }, { duration: '15m', target: 0 },
  ] },
  soak: { maxVus: 300, stages: [
    { duration: '5m', target: 300 }, { duration: '2h', target: 300 },
    { duration: '5m', target: 0 },
  ] },
});

export function chooseJourney(unitRandom) {
  if (!Number.isFinite(unitRandom) || unitRandom < 0 || unitRandom >= 1) throw Error('Expected random value in [0, 1)');
  let point = unitRandom * 100;
  for (const item of TRAFFIC) {
    point -= item.weight;
    if (point < 0) return item.name;
  }
  return TRAFFIC[TRAFFIC.length - 1].name;
}

export function validateConfig(env) {
  const profileName = env.PERF_PROFILE || 'smoke';
  const profile = PROFILES[profileName];
  if (!profile) throw Error('Unknown PERF_PROFILE');
  if (env.PERF_ISOLATED !== 'I_CONFIRM_SYNTHETIC_ONLY') throw Error('Explicit PERF_ISOLATED confirmation required');
  if (!/^cpsu_marketplace_(test|perf|staging)(_[a-z0-9_]+)?$/.test(env.PERF_DB_NAME || ''))
    throw Error('PERF_DB_NAME must identify an isolated synthetic database');
  if (env.PERF_DB_VERIFIED !== 'I_CHECKED_API_DATABASE_TARGET')
    throw Error('Verify the running API connection actually points to the isolated database');
  const url = new URL(env.PERF_BASE_URL || 'http://127.0.0.1:4400');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/')
    throw Error('PERF_BASE_URL must be a bare HTTP(S) origin without credentials or path');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!loopback) {
    if (env.PERF_STAGING_APPROVED !== 'YES' || env.PERF_APPROVED_HOST !== url.hostname)
      throw Error('Non-loopback hosts require exact hostname approval');
    if (url.hostname === 'cpsu.edu.ph' || url.hostname.endsWith('.cpsu.edu.ph'))
      throw Error('University-operated domains are not load test targets in this harness');
    if (url.protocol !== 'https:') throw Error('Approved remote staging must use HTTPS');
  }
  if (!['smoke', 'baseline'].includes(profileName) &&
      (env.PERF_APPROVED_STAGE !== profileName || env.PERF_STAGING_APPROVED !== 'YES'))
    throw Error('Significant load stages require explicit matching stage and staging approvals');
  if (profile.maxVus > 300 && env.PERF_CAPACITY_APPROVED !== 'YES')
    throw Error('High-concurrency stages require dedicated load-generator capacity approval');
  if (env.PERF_ENABLE_WRITES === 'YES' && env.PERF_APPROVED_WRITES !== 'I_APPROVE_SYNTHETIC_MUTATIONS')
    throw Error('Writes require a second explicit approval');
  return { profileName, profile, baseUrl: url.origin };
}

export function pickByVu(items, vu) {
  return Array.isArray(items) && items.length ? items[(vu - 1) % items.length] : null;
}
