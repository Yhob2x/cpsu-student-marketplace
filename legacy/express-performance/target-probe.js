// Called by k6 setup() before it sends a SINGLE workload request.
// A declaration of PERF_DB_NAME alone is not proof of runtime API isolation.
import http from 'k6/http';
import { assertIsolatedApiAttestation } from './config.js';

export function verifyTargetBeforeLoad(settings, env) {
  const response = http.get(settings.baseUrl + '/__perf/identity', {
    headers: { 'X-CPSU-Perf-Token': env.PERF_TARGET_TOKEN },
    timeout: '3s',
    tags: { endpoint: 'preflight_identity', kind: 'preflight' },
  });
  if (response.status !== 200)
    throw Error('Isolated performance API attestation unavailable: no load generated');
  let data;
  try { data = response.json(); }
  catch { throw Error('Malformed performance API attestation: no load generated'); }
  assertIsolatedApiAttestation(data, env.PERF_DB_NAME);
  return true;
}
