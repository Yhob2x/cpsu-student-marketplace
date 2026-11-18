// OPT-IN ONLY: one synthetic buyer's follow/unfollow and message submission.
// Never run on the ordinary development DB or any real student infrastructure.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { validateConfig } from './config.js';

const config = validateConfig(__ENV);
if (config.profileName !== 'smoke') throw Error('Writes harness only supports smoke profile');
if (__ENV.PERF_ENABLE_WRITES !== 'YES' ||
    __ENV.PERF_APPROVED_WRITES !== 'I_APPROVE_SYNTHETIC_MUTATIONS' ||
    __ENV.PERF_WRITE_FIXTURES_VERIFIED !== 'I_VERIFIED_ALL_SYNTHETIC_IDS')
  throw Error('Synthetic write tests require separate written scope and fixture approval');
const fixtures = JSON.parse(open(__ENV.PERF_FIXTURES || './fixtures.example.json'));
const plan = fixtures.writePlan;
if (!plan || !Number.isInteger(plan.followStoreId) || !Number.isInteger(plan.threadId))
  throw Error('Provide test-only writePlan.followStoreId and writePlan.threadId');
const buyer = (fixtures.accounts || []).find(a => a.role === 'student');
if (!buyer || !buyer.email.endsWith('.test') || !buyer.password)
  throw Error('Provide one synthetic test buyer account ending in .test');

export const options = {
  scenarios: { synthetic_write_smoke: { executor: 'shared-iterations',
    vus: 1, iterations: 1, maxDuration: '30s' } },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true }],
  },
};

function request(method, path, body, token, name) {
  const params = { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    tags: { endpoint: name, kind: 'write' }, timeout: '10s' };
  return http.request(method, config.baseUrl + path, body === null ? null : JSON.stringify(body), params);
}
export default function () {
  const login = http.post(config.baseUrl + '/api/v1/auth/login',
    JSON.stringify({ email: buyer.email, password: buyer.password }), {
      headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
      tags: { endpoint: 'synthetic_login' }, timeout: '10s',
    });
  check(login, { 'test login succeeded': r => r.status === 200 });
  const token = login.status === 200 ? login.json('accessToken') : null;
  if (!token) throw Error('Synthetic login was not successful');
  const id = plan.followStoreId;
  const follow = request('PUT', '/api/v1/store-follows/' + id, null, token, 'synthetic_follow');
  check(follow, { 'follow stored': r => r.status === 200 && r.json('isFollowing') === true });
  sleep(2);
  const unfollow = request('DELETE', '/api/v1/store-follows/' + id, null, token, 'synthetic_unfollow');
  check(unfollow, { 'follow removed': r => r.status === 200 && r.json('isFollowing') === false });
  const marker = 'SYNTHETIC-PERF-' + __VU + '-' + __ITER;
  const msg = request('POST', '/api/v1/inquiries/' + plan.threadId + '/messages',
    { body: marker }, token, 'synthetic_message');
  check(msg, { 'synthetic message created': r => r.status === 201 });
  // Messages remain only in the separately authorized synthetic test database.
  // The message cannot be deleted through the product's supported API.
}
