import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { chooseJourney, pickByVu, validateConfig } from './config.js';

const settings = validateConfig(__ENV); // Fails before any network traffic.
const fixtures = JSON.parse(open(__ENV.PERF_FIXTURES || './fixtures.example.json'));
if (!['smoke', 'baseline'].includes(settings.profileName) && __ENV.PERF_PUBLIC_ONLY !== 'YES') {
  if (!Array.isArray(fixtures.accounts) || fixtures.accounts.length < settings.profile.maxVus ||
      !fixtures.accounts.some(a => a.role === 'seller') ||
      !fixtures.accounts.some(a => a.role === 'student'))
    throw Error('Mixed-load stages require distinct synthetic accounts >= maxVus and both student/seller roles; alternatively explicitly use PERF_PUBLIC_ONLY=YES and report it as public-only');
}
const skipped = new Counter('cpsu_skipped_steps');
const journeys = new Counter('cpsu_journeys');
let tokens = {}; // Per virtual-user JS runtime; do not share tokens across users.

export const options = {
  scenarios: {
    marketplace: {
      executor: 'ramping-vus', startVUs: 0,
      stages: settings.profile.stages,
      gracefulRampDown: '10s', gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{kind:read}': [
      { threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '30s' },
      { threshold: 'p(99)<1500', abortOnFail: true, delayAbortEval: '30s' },
    ],
  },
  tags: { profile: settings.profileName },
  discardResponseBodies: false,
};

function json(response) {
  try { return response && response.body ? response.json() : null; } catch (_) { return null; }
}
function get(path, tag, token) {
  const response = http.get(settings.baseUrl + path, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    tags: { endpoint: tag, kind: 'read' }, timeout: '10s',
  });
  check(response, { 'read status 2xx': r => r.status >= 200 && r.status < 300 });
  return json(response);
}
function requireAuth(role = 'student') {
  const pool = (fixtures.accounts || []).filter(a =>
    a.role === role || (role === 'student' && a.role === 'seller'));
  if (!pool.length) { skipped.add(1, { reason: 'no_synthetic_accounts' }); return null; }
  const account = pickByVu(pool, __VU);
  if (!account.email.endsWith('.test') || typeof account.password !== 'string' || !account.password)
    throw Error('Fixture accounts must use synthetic .test identities');
  if (tokens[account.email]?.expiresAt > Date.now()) return tokens[account.email].token;
  const r = http.post(settings.baseUrl + '/api/v1/auth/login',
    JSON.stringify({ email: account.email, password: account.password }), {
      headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
      tags: { endpoint: 'auth_login', kind: 'auth' }, timeout: '10s',
    });
  check(r, { 'synthetic login succeeded': x => x.status === 200 });
  const token = json(r)?.accessToken;
  if (!token) { skipped.add(1, { reason: 'login_failed' }); return null; }
  tokens[account.email] = { token, expiresAt: Date.now() + 13 * 60 * 1000 };
  return token;
}

function listingSample() {
  const result = get('/api/v1/listings?page=1&pageSize=20', 'listings_index');
  return pickByVu(result?.items, __VU) || null;
}
function home() {
  get('/api/v1/home-page', 'home_editorial');
  get('/api/v1/categories', 'categories');
  get('/api/v1/listings/fresh', 'listings_fresh');
  get('/api/v1/listings/popular', 'listings_popular');
  get('/api/v1/stores/most-followed', 'stores_popular');
}
function explore() {
  const term = encodeURIComponent(pickByVu(fixtures.searchTerms || ['notebook'], __VU));
  get('/api/v1/listings?q=' + term + '&sort=newest&page=1&pageSize=20', 'listing_search');
  get('/api/v1/listings?type=service&sort=price_asc&page=1&pageSize=20', 'listing_filter');
  get('/api/v1/listings?sort=price_desc&page=2&pageSize=20', 'listing_page2');
}
function details() {
  const item = listingSample();
  if (!item) { skipped.add(1, { reason: 'no_published_listing' }); return; }
  get('/api/v1/listings/' + item.id, 'listing_detail');
  if (item.seller?.id) {
    get('/api/v1/seller-profiles/' + item.seller.id, 'store_detail');
    get('/api/v1/seller-profiles/' + item.seller.id + '/connections?countsOnly=true', 'store_follows_count');
  }
  if (Array.isArray(item.images) && item.images.length && fixtures.includeMedia === true) {
    // Fetch actual media bytes but avoid downloading every image in each iteration.
    const r = http.get(settings.baseUrl + item.images[0], {
      tags: { endpoint: 'listing_media', kind: 'media' }, timeout: '15s',
      responseType: 'none',
    });
    check(r, { 'media status 2xx': x => x.status >= 200 && x.status < 300 });
  }
}
function messaging() {
  const token = requireAuth();
  if (!token) return;
  const threads = get('/api/v1/inquiries', 'inbox', token);
  if (Array.isArray(threads) && threads.length) {
    // IMPORTANT: reading messages also updates synthetic delivery receipts in this API.
    get('/api/v1/inquiries/' + threads[0].id + '/messages', 'messages', token);
  }
}
function seller() {
  const token = requireAuth('seller');
  if (!token) return;
  get('/api/v1/seller/store', 'seller_store', token);
  get('/api/v1/seller/listings', 'seller_listings', token);
  get('/api/v1/store-follows/mine?countsOnly=true', 'seller_followers', token);
}
function social() {
  const item = listingSample();
  if (!item?.seller?.id) { skipped.add(1, { reason: 'no_visible_store' }); return; }
  const id = item.seller.id;
  get('/api/v1/seller-profiles/' + id + '/connections?countsOnly=true', 'social_counts');
  if (fixtures.features?.storeReviews === true)
    get('/api/v1/seller-profiles/' + id + '/reviews?page=1', 'store_reviews');
}
function transactions() {
  const token = requireAuth();
  if (!token) return;
  const data = get('/api/v1/transactions?page=1&pageSize=20', 'transactions', token);
  if (Array.isArray(data?.items) && data.items.length)
    get('/api/v1/transactions/' + data.items[0].id, 'transaction_detail', token);
}
function notifications() {
  const token = requireAuth();
  if (!token) return;
  get('/api/v1/notifications/unread-count', 'notifications_unread', token);
  get('/api/v1/notifications', 'notifications_feed', token);
}

export default function () {
  // Smoke must exercise actual public endpoints even with no synthetic accounts.
  if (settings.profileName === 'smoke') {
    journeys.add(1, { journey: 'public_smoke' });
    home();
    sleep(1);
    return;
  }
  const journey = chooseJourney(Math.random());
  journeys.add(1, { journey });
  ({ home, explore, details, messaging, seller, social, transactions, notifications })[journey]();
  // Realistic independent think-time; numbers represent virtual API sessions, not browsers.
  sleep(3 + Math.random() * 17);
}
