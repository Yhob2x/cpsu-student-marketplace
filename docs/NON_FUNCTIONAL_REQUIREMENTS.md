# Non-functional requirements — status

Each row states the blueprint requirement, the as-built reality, and the gap. Performance figures are **not** measured; where no benchmark
exists the row says so rather than claiming a target is met.

## 1. Performance and scale

| Requirement | As-built | Gap |
|---|---|---|
| Fast discovery on low-end phones and slow networks | Server-side pagination (`pageSize` ≤ 50, default 20); images lazy-loaded on web; 3 s polling for threads. No measured benchmark. | No `sort` parameter; no image resizing/thumbnails (full upload served), so mobile users can download multi-MB photos. |
| Indexed queries for discovery | Primary keys and unique constraints only. No composite index on `(status, categoryId, campusId, createdAt)`. | Blueprint §7.2 "appropriate indexes" and `docs/architecture.md` §7 recommendation are unmet. Fine at pilot volume, not at scale. |
| Bounded request size | JSON body ≤ 100 KB; uploads ≤ 3 MB, 1 file/request. | — |
| Rate limiting | 300 requests/min/IP globally; `/auth` 30 per 15 min in production (300 otherwise). | In-memory store: limits are per process, not shared across instances. |
| Mobile image handling | Client sends the original file. | No client-side compression before upload. |

## 2. Reliability

| Requirement | As-built | Gap |
|---|---|---|
| Recoverable failure, no silent data loss | Express error handler returns typed JSON errors; Prisma calls awaited. | No retry/offline queue; a failed upload after a listing is created leaves a photo-less draft (recoverable by the seller). |
| Backups include photos | `infrastructure/backup/backup.sh` covers database **and** uploads. | Restore has not been exercised in this environment (blueprint §15 requires it). |
| Uptime monitoring, alerts | Not configured. | Missing. |
| Media upload failure handling | multer errors surface as `400 invalid_image`. | No disk-space monitoring. |

## 3. Security and privacy

Detailed controls and gaps are in `docs/SECURITY_GUIDELINES.md`. Summary: authentication, session handling, validation, and authorization are
implemented; password recovery, email verification, account suspension, retention/deletion jobs, and upload content inspection are not.

## 4. Accessibility

| Requirement | As-built | Gap |
|---|---|---|
| Semantic, accessible forms | Labelled inputs (`aria-label`), `role="alert"` for errors, `role="status"` for success, 48 px touch targets and accessibility labels on mobile, `accessibilityLiveRegion` on messages. | No automated accessibility audit; keyboard focus styling is minimal; no skip link. |
| Screen-reader usable mobile app | `accessibilityRole`/`accessibilityLabel`/`accessibilityState` used on interactive components. | Not tested with VoiceOver/TalkBack. |
| Reduced motion | No animations beyond loading skeletons. | — |

## 5. Responsive design

| Requirement | As-built | Gap |
|---|---|---|
| Mobile-first student experience | Web has a bottom tab bar (`tabbar`) and responsive grid/rail CSS; mobile app is the primary native surface. | No visual regression or device-matrix testing performed. |
| Desktop-optimized administration | Review queue is a stacked desktop layout. | Not verified below 768 px. |
| PWA | Not implemented: no manifest, no service worker, no install prompt. | Blueprint lists PWA as the platform. Needs a decision (conflict C6). |

## 6. Compatibility and localization

| Requirement | As-built | Gap |
|---|---|---|
| Modern mobile and desktop browsers | React 18 + Vite output; no polyfills. | No browser matrix tested. |
| Currency and dates | `Intl.NumberFormat('en-PH', PHP)` on web; manual formatting on mobile; dates via `toLocaleString`. | Mobile formatting is not locale-aware. |
| Language | English only. | Filipino/regional language support not planned in MVP. |

## 7. Maintainability

| Requirement | As-built | Gap |
|---|---|---|
| Modular API | Feature routers (`auth`, `public`, `account`, `seller`, `inquiries`, `admin`) with shared `http`, `audit`, `permissions`, `rules` modules. | Business logic sits inside route handlers; a service layer would help before the transaction module is added. |
| Shared contracts between web and mobile | Types duplicated per client; no `packages/contracts`. | Included in the pilot's plan, not built. |
| Automated tests | 5 unit tests on pure authorization helpers. | No API integration, authorization, database, or component tests (PART X expects all of these). |
| Documentation | This blueprint-aligned set plus the pilot's design notes. | Must be updated per change (RULE 10). |

## 8. Capacity assumptions (explicitly unvalidated)

Pilot targets in `docs/architecture.md` §14: 20 verified sellers, 10 service providers, 50 listings, three colleges, 100 buyers. These are
planning figures, not measured requirements, and no load test has been run.
