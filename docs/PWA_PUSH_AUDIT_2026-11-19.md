# CPSU Market — PWA and Web Push audit
**Date:** 19 November 2026 (Asia/Manila)  
**Scope:** React/Vite PWA and Express/Prisma Web Push. Expo excluded.  
**Machine:** Local Windows developer workstation. **Iteration:** 4/5 (remaining work blocked by separately approved schema/policy and physical-device/HTTPS staging gates).  
**Release status:** BLOCKED. No commit, push, hosting deployment, migrations, credentials rotation or real-user notifications.

## Iteration 4 — bounded dispatch, client resilience and performance evidence (19 November 2026)
**Scope:** Local code-only safety and verification. The real Web Push relay, enrollment/delivery configuration, schema, dependencies, migrations, credentials and student records were not touched.

### Implementation and regressions
- **PUSH-12 — bounded per-notice device concurrency:** `apps/api/src/push-delivery.ts` adds `allSettledBounded`, preserving each device's input-ordered success/rejection outcome, continuing when one device fails, and limiting concurrent sends. `apps/api/src/push.ts` uses **four parallel requests per notification** (the existing subscription query still caps each user at eight devices). This reduces per-event bursts but **does not** implement a process-wide/global send limit, durable queue, or provider throughput guarantee.
- **PUSH-13 — synthetic burst model:** `apps/api/test/push-delivery.test.ts` verifies 8 device tasks never exceed 4 in flight, checks failure isolation and empty inputs, and exercises **2,000 synthetic tasks with no provider or database traffic**. This measures only memory-scheduling behavior; it is **not** proof of 2,000 notifications/minute from the real API.
- **PUSH-14 — truthful unsubscribe status:** `apps/web/src/push-reconciliation.ts` now treats `PushSubscription.unsubscribe()` resolving `false` as a failure, not successful removal. `apps/web/test/push-reconciliation.test.ts` adds the corresponding regression. If the browser cannot detach an unowned subscription, a prior student's push enrollment may still be present; this code detects the failed cleanup but cannot guarantee detachment while offline. Browser/OS account-switch behavior still requires physical-device acceptance.
- **PUSH-15 — isolated tab messaging:** `apps/web/public/sw.js` catches individual `client.postMessage` failures after a push; a closing/crashed tab cannot prevent other open tabs from receiving `CPSU_PUSH_RECEIVED`. `apps/api/test/pwa-worker.test.ts` covers that failure.
- **PWA-08 — local performance baseline:** `apps/web/pwa-tests/pwa-performance.pw.ts` (new) collects navigation, first-contentful paint, latest LCP observation and resource sizes from the built public home page. The observed synthetic baseline on the successful rerun was desktop FCP/LCP **396 ms**, mobile-emulated FCP/LCP **432 ms**, and JS+CSS resource encoded size about **222 KiB** each. These measurements reflect localhost preview only, with no live API/campus network, production CDN, authenticated listings, real phone CPU or installed iOS WebView; they **cannot certify** Lighthouse 90+, real LCP 2.5 seconds, or cold start 2 seconds.

### Verification after implementation
| Check | Iteration 4 result |
|---|---|
| API unit suite | **275 passed, 8 opt-in integration cases skipped, 0 failed** |
| Web unit suite | **193 passed, 0 failed** |
| API typecheck, web typecheck and production Vite build | **PASS** (existing >500 KiB chunk warnings remain) |
| PWA Chromium browser suite | **20/20 passed** (10 desktop + 10 emulated 390 px mobile) on isolated rerun |
| Targeted delivery tests | **8/8 passed**, including four new bounded-dispatch cases |
| Service-worker synthetic cases | **12/12 passed**, including failed tab messaging |
| Push account-ownership tests | **9/9 passed**, including browser unsubscribe(false) |
| PWA assets / staging templates | **PASS / 16 of 16 PASS** |
| Diff whitespace | PASS; ordinary Windows CRLF Git warnings are not diff errors |

The first 20-case Chromium run recorded **18 passes and 2 connection-refused failures** when the temporary Vite preview server exited with code 9 mid-run. Both failures were navigation failures caused by the disappeared localhost server, not failing UI assertions. The isolated rerun completed **20/20**; the sporadic preview-process interruption remains a test-infrastructure observation to monitor in CI.

### Next architectural gate — reviewed plan, not applied
The existing Prisma schema has `Notification` (canonical in-app notice), `PushSubscription` (userId, endpointHash, browser push encryption key material and expiry) and `PushPreference` (three category flags). It has **no durable push outbox, send-attempt ledger, quiet-hour fields, account-wide master-off or daily budget**.

Before any schema/migration edit, request separate owner/DPO/release review of:

1. **Outbox and idempotency:** Proposed additive `PushOutbox` keyed uniquely by the committed `Notification.id`, with recipient, category, state, retry time, expiry and lease metadata. Generate generic safe payload from the existing notice; do not store private message text or duplicate credential URLs in the queue. Consider a per-subscription send-attempt table keyed by (outboxId, subscriptionId) so a retried job can detect completed endpoints, with the explicit caveat that external Web Push cannot guarantee exactly-once delivery after a crash.
2. **Worker safety:** Lease/claim jobs atomically, cap worker-wide concurrency separately from the current 4-device limit, enforce retry deadlines and TTL, and schedule 429/Retry-After plus 408/5xx/network retries with exponential backoff/jitter. Expired 404/410 endpoints remain removal-only. Emergency stop flags must fail closed; new workers must never activate based on VAPID keys alone.
3. **Consent, hours, budget:** Proposed `PushPreference` extensions for a master switch and quiet hours, plus an account/day delivery budget enforced **across devices before fanout**. Proposed five alerts per recipient per day and a daily boundary using `Asia/Manila` need explicit approval; do not silently impose these as existing policy. Decide whether urgent transactions bypass quiet hours/caps, and what happens during daylight/timezone changes.
4. **Observability/privacy:** Durable aggregate accepted/rejected/expired/throttled counters, queue depth/age, retry and unsubscribe metrics, privacy-reviewed retention, an approved operator alert destination for a >5% provider-failure threshold, and access controls that never expose subscription capability URLs, student names or lock-screen content.
5. **Release and rollback:** Preflight backup, restore rehearsal and isolated test database first; additive reversible migration with no application-data deletion, separate subscription/delivery flags default OFF, synthetic 2,000/min load without real endpoints, real HTTPS headers, then consenting physical Android/iOS acceptance. Rollback disables dispatch before considering schema removal, preserving the canonical in-app notices and auditing any queue cleanup.

**G13/G14/G21 remain NOT COMPLETE:** Bounded per-event dispatch does not replace a durable queue, provider retries, recipient-level caps, or production monitoring. G8 has a useful localhost baseline, not a release metric. **G23 iteration 4/5** is complete locally; production release remains blocked.

---

## Iteration 3 — push ownership, subscription rotation and safe deep links (19 November 2026)
**Scope:** Local code-only safeguards and synthetic/browser tests. The approved MVP prioritizes in-app notifications; optional background Web Push remains production-gated. No migration, relay sending, new dependencies, deployment or commit.

### Fixed and tested
- `PUSH-08` **Account-switch privacy:** `apps/web/src/push-reconciliation.ts` (new) checks whether the currently signed-in account owns the browser's existing push endpoint. It rechecks a negative response to avoid racing an explicit Enable action, then locally detaches an unowned endpoint. If the ownership check fails because of an API/network outage, it **fails closed**, detaching locally rather than allowing a previous account's alerts to appear on the shared device. A mid-request account change cancels cleanup, allowing the new account's own check to run. No automatic account enrollment or server-side transfer is performed. This has a deliberate availability tradeoff: a transient ownership-check outage can require the rightful student to manually re-enable alerts. A failed detach cannot be reported as successful. Eight unit cases cover these states.
- `PUSH-09` **Notification tap recovery:** `apps/web/public/sw.js` falls back to a fresh window if the browser fails to enumerate clients or focus a matching tab; existing tabs containing drafts are not navigated. Route validation still rejects external, encoded, or malformed destinations and falls back to `/notifications`. Three synthetic worker click cases added.
- `PUSH-10` **Subscription rotation:** A `pushsubscriptionchange` event notifies open app windows with a nonpersonal event string. `apps/web/src/push-settings.tsx` reflects the disconnection and asks the student to use **Enable alerts** again. The service worker does **not** use bearer credentials, subscribe automatically, or send to the push relay. Two synthetic worker cases cover client and no-client paths. Some browsers may not dispatch this event reliably; next opening of the settings screen checks subscription ownership independently.
- `PUSH-11` **Signed-out deep links:** Added Chromium checks that `/inquiries/:id`, `/transactions/:id`, `/notifications` and `/profile` route to login with the exact allowlisted internal return path. Two browser cases (desktop, mobile emulation) passed.
- Other files: `apps/web/src/push-client.ts`, `apps/web/test/push-reconciliation.test.ts` (new), `apps/api/test/pwa-worker.test.ts`, `apps/web/pwa-tests/pwa-safety.pw.ts`.

### Validation
| Gate | Outcome |
|---|---|
| API `bun test` | **270 passed**, 8 opt-in integration tests skipped, 0 failed |
| Web `bun test test` | **189 passed**, 0 failed; previously failing campus/category tests now pass after concurrent UI work |
| API TypeScript check | PASS |
| Web TypeScript/Vite production build | PASS, with existing >500 kB chunk size warnings |
| Production-build Playwright PWA suite | **18/18 passed** across desktop and 390px mobile Chromium |
| Targeted new cases | 8 push-ownership web tests, 5 new worker tests and 2 signed-out deep-link browser cases |
| PWA icons/manifest | PASS |
| Staging configuration template checks | **16/16 passed** |
| Diff whitespace check | PASS (Git emitted Windows CRLF normalization warnings, not errors) |
| Real mobile OS push, relay, HTTPS staging | **NOT VERIFIED**; release still BLOCKED |

### Unfinished goals and prerequisite plan
G12/G16 improve in local synthetic and Chromium checks only. Physical notification tap from a locked device, OS subscription refresh, browser provider delivery, real account-switch testing, and the shared-device failure states remain unverified on installed Android/iOS PWAs.

**Schema/release plan for separate approval, not implemented:** Define a durable outbox with unique (recipient,event) idempotency keys, bounded leasing/acknowledgment, retention and exponential retry with jitter; server-enforced account master-off, quiet hours in a documented local time zone, recipient-level 5/day cap across devices, and durable metrics/alert thresholds. Review migration rollback and DPO retention before creating or applying schema. Perform synthetic 2,000/min burst acceptance only in an isolated approved test environment. Only then activate enrollment and delivery in independent HTTPS staging gates with approved VAPID contact and consenting test accounts.

**G23 iteration 3/5:** No production-readiness claim; permissions/physical devices, durable queue, policy/observability, actual HTTPS caching and performance remain blocked.

---

## Iteration 2 — local A→B update acceptance (19 November 2026)
**Scope:** Continue PWA/push-only source changes, synthetic tests and local HTTP Chrome. **No deployment, database migration, new dependencies, real push sending or changes to release flags.**

### Changes
- `apps/web/src/pwa-status.tsx`: Returning to a visible app now rediscovers a waiting update previously dismissed with **Later**; the student's explicit update and edited-input safeguard remain.
- `apps/web/public/sw.js`: Null/array/primitive push data now yields a privacy-safe generic notification instead of a worker error.
- `apps/web/pwa-tests/pwa-update.pw.ts` (new): Runs a copy of the built app through a disposable localhost server, replaces build A's worker with build B's worker, and checks both the edited and clean update paths. The copy lives in the OS temp directory and is deleted in the test cleanup; it cannot affect any production service worker or database.
- `apps/api/test/pwa-worker.test.ts`: Added malformed-payload fallback acceptance.

### Measurements
- **16/16 Playwright tests passed** on the built PWA (eight desktop Chromium and eight 390px mobile-emulated Chromium): six original safety cases, four A→B acceptance cases, plus six additional standalone-fallback/slow-network/flaky-API checks. Tested waiting registration, edited-input preservation, deferred prompt rediscovery, explicit skipWaiting/controller change/reload, and v4 cache removal on v5 activation.
- **265 API unit tests passed**, **8 opted-in integration suites skipped**, **0 failed**; the API typecheck passed.
- Static PWA asset validation passed; **16/16** staging configuration checks passed. Staging push flags remain disabled.
- **Separate full web-suite status: 178 passed / 2 failed** in `test/catalog-admin.test.tsx` (campus/category admin). Reproduced by running that test alone: accessible names are now descriptive (`Edit campus Main Campus`, etc.) rather than the test's expected generic `Edit`. The admin component and tests were **not modified by this PWA audit**, and this out-of-scope UI mismatch must be reconciled by the parallel admin/UI work before G22 can be considered met.
- Local slow-network navigation (400ms latency, 50,000 B/s download throughput) and alternate aborted/503 API responses passed on both Chrome configurations; these are browser emulations, not physical weak-signal acceptance.
- Attempted CDP `display-mode: standalone` emulation was unsupported (media query remained false). Replaced this unsupported assertion with an explicitly **synthetic iOS `navigator.standalone` fallback** test, which passed. Real installed iOS/Android standalone behavior, native installability, live Web Push provider deliveries, Lighthouse performance and staging HTTPS headers remain **unverified**.

### Goal status changes from iteration 1
- **G4**: Simulated iOS standalone install-button suppression passed; real installed standalone navigation, safe areas, keyboard and browser back behavior remain unverified.
- **G7**: Local offline, throttled network and flaky-API browser scenarios passed; physical weak-signal and unsent-write behavior remain unverified.
- **G9**: A→B update path **PASS locally** in Chromium desktop/mobile emulation (physical phones and hosted deployment still unverified). The existing design conservatively blocks update activation after any input edit during a tab session; restarting the app after saving remains the safe fallback.
- **G10**: Old-cache deletion after explicit activation **PASS locally**; real bad-deploy recovery and live-host headers still unverified.
- **G15**: Generic fallback now tested for null, arrays and primitive push data.
- **G22**: **Not met for the shared working tree** because two non-PWA admin tests fail. PWA-specific build and browser acceptance have passed, but global regression cannot be claimed.

### Files additionally changed in iteration 2
- `apps/web/src/pwa-status.tsx`, `apps/web/public/sw.js`
- `apps/web/pwa-tests/pwa-update.pw.ts` (new)
- `apps/api/test/pwa-worker.test.ts`
- This audit report

**Staging remains BLOCKED.** Do not enable push flags or deploy to real students. Persistent queue, daily push caps, quiet hours, monitoring and real mobile push acceptance remain deferred pending separately reviewed approval.

---

## Decisions and safety boundaries
- Keep the handwritten service worker and existing `web-push` dependency. No new dependency or Prisma schema change.
- Keep offline support restricted to a public fallback and icons. The service worker **does not cache** HTML app pages, API responses, authenticated information, personal images, messages, transactions or payments. This intentionally falls short of the specified complete app-shell precache goal.
- Keep `PUSH_SUBSCRIPTIONS_ENABLED` and `PUSH_DELIVERY_ENABLED` independently default OFF; do not modify real environment variables.
- In-app notices remain durable even when Web Push is unavailable. All real relay sends remain disabled in development and tests.

## Before / after measurements
| Check | Baseline | After this batch | Evidence |
|---|---|---|---|
| Manifest + image dimensions | 5/5 validated | 5/5 validated | `bun run pwa:check` |
| Staging template safeguards | 16/16 | 16/16 | `bun run push:staging:templates` |
| Focused push/PWA unit cases | 21 pass | 27 pass | `bun test test/pwa-worker.test.ts test/push.test.ts test/push-policy.test.ts test/push-delivery.test.ts test/store-publication-notifications.test.ts` |
| API complete unit suite | Not remeasured before implementation | **264 passed, 8 opt-in skipped, 0 failed** | `apps/api: bun test` |
| Web complete unit suite | Not remeasured before implementation | **180 passed, 0 failed** | `apps/web: bun test test` |
| Real Chrome PWA scenarios | Unmeasured | 6/6 (3 each desktop, 390px mobile emulation) | `apps/web: bunx playwright test --config playwright.pwa.config.ts` |
| HTML/API URLs in SW cache | No intercepted API caching by static review | 0 observed in desktop/mobile Chromium cache inspection | Playwright + synthetic worker |
| First-load permission prompts | Unmeasured | 0 observed in two Chromium configurations | Playwright permission spy |
| Build/typecheck | Baseline web build and API tsc pass | Web build and API tsc pass | `bun run build`, `bunx tsc -p . --noEmit` |
| Lighthouse/LCP/cold start | Unmeasured | Unmeasured | Lighthouse not available in this audit |
| Physical iPhone/Android/background relay | Unverified | Unverified | No approved trusted HTTPS staging or device acceptance |
| Release gates | 2 blocked | 2 blocked | Staging checker: public domain + approved VAPID contact |

The Chromium checks are browser emulation, not physical-device verification. No real device received a Web Push.

## Goal register (G1–G22)
| Goal | Status | Evidence / gap |
|---|---|---|
| G1 Installability | PARTIAL | Manifest and icons valid; native install prompt not measured on real phone |
| G2 Manifest/icons | PASS static | 192/512 any, 192/512 maskable, 180 Apple plus id/name/shortcuts |
| G3 Splash/theme | PASS static | Manifest and HTML match shared primary color token; physical splash flash unverified |
| G4 Standalone view | UNVERIFIED | No real iOS/Android standalone safe-area/keyboard/back suite |
| G5 Service worker | PASS local | Registration, install, activation, stale cache removal in unit/Chromium tests |
| G6 Cache strategy | PARTIAL | 0 API/personal URLs in SW cache; full shell and image cache-first not implemented |
| G7 Offline | PARTIAL | Offline navigation + active-screen notice pass Chrome; Slow 3G/flaky unverified |
| G8 Performance | UNMEASURED | Lighthouse ≥90, LCP ≤2.5s, cold start ≤2s not measured |
| G9 App updates | PARTIAL | Explicit waiting worker activation; edited-input reload blocked; real build A→B unverified |
| G10 Stale-worker recovery | PARTIAL | Offline repair, versioned cache deletion, Nginx no-cache source config; live headers unverified |
| G11 Permission UX | PARTIAL | Zero first-load prompts in 2 Chrome contexts; default/granted/denied full device acceptance unverified |
| G12 Subscription lifecycle | PARTIAL | Auth/owner-scoped subscriptions and logout cleanup implemented earlier; background rotation not handled |
| G13 Server delivery | FAIL | No persistent queue/outbox, batching/2,000-per-minute performance not verified |
| G14 Failure handling | PARTIAL | 404/410 deletion and one bounded retry for 408/5xx/network tested; 429 not queued |
| G15 Content | PASS local | All 14 mapped types within copy limits, private generic bodies, icon/badge/tag/id/type/url |
| G16 Notification click | PARTIAL | Synthetic closed-window, matching-window and unrelated-draft preservation pass; real 3-state + login checks unverified |
| G17 Preferences | FAIL | Three server-enforced category choices exist; no master off across devices or quiet-hour schedule |
| G18 Anti-spam | FAIL | Foreground target suppressed in SW; persistent per-user daily cap, dedupe queue and server-side current-screen state absent |
| G19 iOS | PARTIAL | Add-to-Home-Screen instructions exist; installed iOS PWA and Web Push unverified |
| G20 Security/privacy | PARTIAL | No known issue in inspected flows; full security assessment/live HTTPS unverified |
| G21 Observability | FAIL | Process-local send/fail/expired/retry counters; no durable clicks/unsubscribes/delivery metrics/alert |
| G22 Regression | PASS local | Existing unit tests, build, typecheck and 6 PWA Chromium tests pass; no full real-device behavior review |

G23: This was the first remediation/verification iteration. Do not claim full exit: several targets need a separately reviewed schema/migration, staging controls, or devices.

## Findings register
| ID | Severity | Finding | Resolution |
|---|---|---|---|
| PWA-01 | P1 | Worker previously called `skipWaiting()` at install with no student choice | FIXED: waiting worker activates only on explicit update action |
| PWA-02 | P1 | No visible safe update workflow | FIXED: update prompt; edited-input block and restart-after-save guidance |
| PWA-03 | P1 | Open SPA lacked clear connection-loss notice | FIXED: accessible online/offline status; Chromium desktop/mobile |
| PWA-04 | P1 | No supported stale-worker recovery flow | FIXED code: offline repair checks connectivity before unregistration; live not verified |
| PUSH-01 | P2 | Alert displayed even while focused on target route | FIXED: foreground suppression + in-app refresh message |
| PUSH-02 | P1 | Notification click navigated an unrelated tab, risking lost drafts | FIXED: focus matching tab or open separate window |
| PUSH-03 | P2 | Encrypted push payload lacked notice ID/type metadata | FIXED: positive ID and event type added; validated by worker |
| PWA-05 | P1 | No complete offline app shell/hashed-asset precache | DEFERRED: deliberate privacy-safe fallback; requires a reviewed asset caching plan |
| PWA-06 | P1 | Real update A→B and bad-deploy recovery not demonstrated | UNVERIFIED pending safe staging test |
| PUSH-04 | P1 | Best-effort sends have no persistent outbox or 2,000/min load proof | DEFERRED: queue table/worker and authorized mock-load test |
| PUSH-05 | P1 | No quiet hours, persisted per-user cap or account-wide master switch | DEFERRED: schema and preference policy approval |
| PUSH-06 | P1 | `pushsubscriptionchange` cannot securely auto-enroll with current in-memory session auth | DEFERRED: explicit account-consent and recovery design |
| PUSH-07 | P1 | Aggregate counters reset at restart; no 5% alert or click tracking | DEFERRED: metrics store and alert destination |
| PWA-07 | P1 | Real device, slow 3G, native install and Lighthouse metrics missing | UNVERIFIED: staged mobile acceptance required |

No P0 data leak was identified in the inspected worker or push payloads. This is not a guarantee of zero security findings across the complete product.

## Notification catalog
All mapped push payloads use title **CPSU Market**, urgency **normal**, TTL **3600 seconds**, generic lock-screen copy and same-origin links. If an identifier is missing, destination becomes `/notifications`. Users opt out by **category**, not each individual event.
| Event / trigger | Body | Deep link | Preference |
|---|---|---|---|
| `inquiry.new` new inquiry | You have a new marketplace inquiry. | `/inquiries/:threadId` | messages |
| `inquiry.reply` new reply | You have a new message. | `/inquiries/:threadId` | messages |
| `listing.decision` review decision | Your listing was approved. / Your listing has a review update. | `/listings/:listingId` | listingReviews |
| `listing.suspended` listing hold | A listing needs your attention. | `/listings/:listingId` | listingReviews |
| `affiliation.decision` affiliation update | Your CPSU account verification has an update. | `/profile` | accountUpdates |
| `store.new_listing` followed store publication | A store you follow has published a new listing. | `/listings/:listingId` | accountUpdates |
| `transaction.requested` purchase/service request | A student sent you a purchase or service request. | `/transactions/:transactionId` | accountUpdates |
| `transaction.accepted`, `transaction.rejected` | The other student updated your transaction. | `/transactions/:transactionId` | accountUpdates |
| `transaction.meetup_confirmed`, `transaction.completion_confirmed`, `transaction.cancelled` | The other student updated your transaction. | `/transactions/:transactionId` | accountUpdates |
| `transaction.meetup_location_shared`, `transaction.meetup_location_revised` | The other student updated your transaction. | `/transactions/:transactionId` | accountUpdates |

`transaction.negotiating` remains in-app only. Price drops, item-sold and general announcement pushes have **no mapped Web Push event** in the inspected code.

## Self-review
- Checked exact worker install/activate transitions, cache versioning, API exclusion and safe offline fallback; added synthetic lifecycle and browser cache assertions.
- Checked notification body allowlist, valid internal links, ID/type fields, matching-tab focus, and unsaved-draft safety.
- Found that querying foreground windows could itself fail and prevent an alert; changed the worker to fall back to showing the privacy-safe alert and added a synthetic test.
- Found that repairing while connectivity was falsely reported online could discard the only offline fallback; added a real `/sw.js` network fetch before deleting a cache.
- Checked that no VAPID private keys, capability URLs or personal notification content were added to logs, files or the browser bundle. No secret values were printed.
- No new Prisma tables or migrations, background jobs, subscriptions, notification sends, or shared data modifications were made.
- No unrelated dirty files were reset, staged or committed. The repository has concurrent unrelated edits; review a scoped diff before merging.

## Manual release and verification gates
1. Obtain CPSU approval for a real HTTPS staging domain and monitored VAPID contact; privacy/DPO review; separate synthetic staging database and operator approval. Do not turn push flags on before authorization.
2. Review all pending Prisma migrations; separately approve any future queue/preferences/metrics schema and write reversible migrations before applying to isolated staging only.
3. Inspect actual HTTPS response headers for `/sw.js`, `/manifest.webmanifest`, `/index.html`, `/offline.html`, `/assets/*`, and `/api/*`. Confirm no student content is HTTP/SW cached.
4. On a physical Chrome Android and iOS 16.4+ installed Safari PWA: install, standalone safe areas, keyboard, offline/3G/flaky states, device lock-screen alerts, permission denial, logout, account switch, deep links, and badges using synthetic consenting users only.
5. On staging build A, leave an unsaved draft open, deploy B, confirm update prompt doesn't reload the draft. Repeat after saving, after closing, and after deliberate offline repair.
6. Add a durable push outbox/worker with idempotency, leases, capped concurrency and retries before mock-testing a 2,000-send/60-second burst. Configure alerts when push-provider failure exceeds 5%. Never use real student subscriptions for a load test.
7. Human review priorities: cache rules, subscription owner checks, quiet-hour/day-boundary semantics, open-redirect protection, token handling and per-type consent.

## Changed files in this audit
- `apps/web/public/sw.js`, `apps/web/public/offline.html`
- `apps/web/src/pwa-status.tsx`, `apps/web/src/pwa-status.css`, `apps/web/src/main.tsx`
- `apps/web/playwright.pwa.config.ts`, `apps/web/pwa-tests/pwa-safety.pw.ts`
- `apps/api/src/push.ts`, `apps/api/test/push.test.ts`, `apps/api/test/pwa-worker.test.ts`
- `scripts/validate-pwa.cjs`
- `infrastructure/nginx/marketplace.conf`, `infrastructure/staging/nginx.conf.template`
- `docs/PWA_PUSH_AUDIT_2026-11-19.md` (this report)

## Known limitations
- iOS notification permission and push require an installed Home Screen PWA; Safari tabs do not provide the same push flow.
- OS Focus/DND, vendor battery settings and browser push relay behavior can suppress alerts.
- Browser push-provider acceptance is not proof of device delivery, and service worker push events cannot securely auto-restore authenticated subscriptions with the current session model.
- Offline mode intentionally provides a generic fallback, not private listings, order details, or unsent-message queue.
