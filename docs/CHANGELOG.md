# Changelog

## 2026-11-24 — Laravel + React migration, Phase 2

- Moved registration, login, refresh, logout, roles, security headers and rate limits to Laravel. Added 39 Eloquent models, 18 enums and a verified schema baseline. Other API routes still use Express through the local-only bridge.
- 38/38 auth scenarios matched Express, and passwords, tokens and sessions work across both backends. No database schema or data changes. See `docs/LARAVEL_MIGRATION_PHASE2_2026-11-24.md`.

## 2026-11-23 — Laravel + React migration, Phase 1

- Added a Laravel 12 app in `laravel-project/` that serves the existing React TypeScript frontend from `resources/`. The API remains Express through a temporary local-only bridge.
- 30/30 signed-out route and viewport comparisons were pixel-identical. Playwright: 187 passed, 5 failed, and the same 5 fail on the original build. See `docs/LARAVEL_MIGRATION_PHASE1_2026-11-23.md`.

## 2026-11-17 — Private student identity registration fields (prepared, collection OFF)

- Added Full name and Student ID number inputs to Create account, with a clear private-data notice and fail-closed registration-policy check. Inputs are visible but disabled until CPSU privacy approval and a separately tested schema migration; the existing account registration flow stays available.
- Prepared a separate private `StudentIdentity` model, unapplied additive migration, an API collection switch requiring a recorded policy reference, and server-side validation preserving leading zeros. New identifiers are not exposed in public profile responses.
- Local synthetic validation and full API/web suites passed; Prisma schema valid, but Windows DLL locking prevented fresh Prisma client regeneration. No real identifiers, DB migration, deployment or Git commit. See `docs/PRIVATE_STUDENT_ID_REGISTRATION_2026-11-17.md`.

## 2026-11-16 — Incoming messages ring; outgoing messages silent

- Reversed the chat sound behavior: **sending is silent**, while a **new incoming** student message detected in an active foreground conversation or Messages inbox rings once with the original ~580ms bell tone. First-load history, repeat polls, outgoing messages and background catch-up do not trigger audio.
- Added receive-sound on/off and Test sound in both inbox and conversation, silent audio unlock on user interaction for iPhone Safari, sound preference persistence and error-resilient inbox polling. No background notification permission or push delivery activation.
- Focused audio tests (8) and web production build pass; physical iPhone verification remains pending. See `docs/IPHONE_MESSAGE_RECEIVE_SOUND_2026-11-16.md`.


## 2026-11-16 — Original 'ting' notification send sound

- Refined the immediate send-tap sound into an **original ~580ms single-strike glass-bell 'ting'** with fading overtones, styled after the user's Zedge 'iPhone'/'ting' reference without reusing the actual audio recording. It uses a locally generated/preloaded WAV for iPhone Safari with corresponding Web Audio fallback. The sound confirms tapping Send, **not** server delivery; API errors and receipts stay authoritative.
- Retained the per-browser Sound on/off toggle and added **Test sound** without posting a message. Muting stops current audio; sound failures never interrupt chat; no incoming push/notification sound is implied.
- Passed six focused audio unit tests, including waveform attack/decay checks, and the TypeScript/Vite web production build. Manual physical-iPhone playback remains to be confirmed. Details: `docs/IPHONE_MESSAGE_SEND_SOUND_2026-11-16.md`.


## 2026-11-16 — Push Stage 6 staging release preflight (local only)

- Added a **read-only**, fail-closed staging release checker (`bun run push:staging:preflight`), a placeholder-only non-secret approval manifest, and eight automated tests. The validator inventories six Prisma migrations and checks every one for explicit staging approval; it also blocks mixed uncommitted source and accidental push activation.
- Default preflight is intentionally **4/16 passed, 12 blocked**, pending approved HTTPS domain, monitored VAPID contact, hosting/privacy decisions, isolated staging data and a clean release snapshot. No staging site or notification was activated.
- The eight preflight tests, 25 API unit tests, 16 staging-template checks and PWA validation passed. Documentation: `docs/PWA_PUSH_STAGE6_STAGING_PREFLIGHT_2026-11-16.md`.


## 2026-11-16 — Push Stage 5 default-off release safety (local only)

- Added two independent, default-OFF server release switches: `PUSH_SUBSCRIPTIONS_ENABLED` controls explicit browser enrollment; `PUSH_DELIVERY_ENABLED` separately controls outbound Web Push. Valid VAPID keys alone no longer activate anything. Test and development modes cannot send real pushes.
- Production-mode enrollment additionally requires a matching VAPID P-256 pair, syntactically valid non-local contact, secure cookies and an explicit public HTTPS origin. The logged-in config reports both enrollment and delivery statuses; the UI indicates when background delivery is paused.
- Added 8 pure security-policy tests and 3 authenticated fail-closed HTTP tests, alongside the previous 7 isolated push integration tests. With both switches off, subscription creation and preference writes return 503; user-scoped opt-out remains available.
- Updated staging environment templates, the readiness checker and template validator to protect the switches. No existing secrets were changed, no remote push was sent, and no public deployment or development database migration was authorized.
- Details: `docs/PWA_PUSH_STAGE5_RELEASE_SAFETY_2026-11-16.md`.


## 2026-11-16 — Push Stage 4 isolated HTTPS staging package (local only)

- Prepared new, **unapplied** Nginx HTTPS, Bun systemd and environment templates under `infrastructure/staging/`; they use placeholders only, prevent API/HTML caching and specify isolated staging credentials, database, OS identity and loopback API access.
- Added optional `BIND_HOST` to the API configuration/entrypoint. The existing default remains `0.0.0.0` for backward compatibility; staging requires `127.0.0.1` and port 4400 behind Nginx. Existing production Nginx/systemd files were not modified.
- Added offline safety validator `bun run push:staging:templates` (**15/15 checks passed**) and an explicit deployment/rollback runbook. Staging remains blocked until approved HTTPS domain, monitored VAPID contact, separate staging DB and migrations, consenting device testers and deployment approval are provided.
- Preserved other uncommitted WP3 transaction work, existing development credentials and live services; no GitHub push, public deployment, production database change or real push delivery.
- Evidence: `docs/PWA_PUSH_STAGE4_STAGING_PREPARATION_2026-11-16.md`.


## 2026-11-16 — Push Stage 3 device readiness (local only)

- Added an explicit **Preview a test alert** action to the signed-in notification settings. Uses the service worker's local `showNotification` only after permission has already been granted; it does **not** send a Web Push, request permission automatically, or write to the database.
- Added read-only `bun run push:staging:check` to audit local VAPID key consistency and Git exclusion, required staging contact/HTTPS URL, PWA/service-worker assets and accidental private-key inclusion in built web assets. Check correctly blocks release while the development-only localhost VAPID subject and missing approved staging URL remain.
- Prepared physical Android Chrome and iPhone Safari acceptance steps and an unfilled evidence matrix at `docs/PWA_PUSH_STAGE3_DEVICE_ACCEPTANCE_2026-11-16.md`. No device acceptance, public deployment, notification permission request or real background push delivery was claimed.

## 2026-11-16 — Push Stage 2 local VAPID and HTTPS QA

- Generated and locally retained one matching P-256 VAPID keypair without displaying secrets; restricted the Git-ignored API `.env` ACL and verified its public-key derivation and idempotent setup.
- Created a seven-day self-signed localhost TLS test certificate (private ACL restricted) and a reproducible local HTTPS gateway. The corrected test-only API launcher explicitly binds `127.0.0.1:4400`, targets the isolated push test database, and suppresses outbound push delivery.
- Chrome HTTPS QA passed manifest/installability checks, secure-context service worker registration, Push/Notification/Badging API detection, responsive widths 320–1440px, and signed-out notification deep links. Test notification permission remained unrequested; no real Web Push subscription or push delivery tested.
- Regression: 17 unit tests, 7 isolated push integration tests and 24 isolated marketplace integration tests passed; API TypeScript and production web build passed. A disposable synthetic account and temporary credentials were cleaned up; public/physical device testing remains blocked.
- Report: `docs/PWA_PUSH_STAGE2_LOCAL_HTTPS_2026-11-16.md`. No GitHub commit, production deployment, key disclosure or development database migration in Stage 2.

## 2026-11-16 — Push Stage 1 local development database activation

- Following explicit owner approval, used the retained database-and-upload backup script, saving a verified 175,557-byte SQL snapshot plus 22 media files privately outside Git. SHA-256 and expected table structure matched the manifest.
- Applied **only** the additive `20261116094000_pwa_push_notifications` migration to local `127.0.0.1:3306/cpsu_marketplace`. Verified `PushSubscription` and `PushPreference` are empty, both foreign keys exist, all five migrations are applied, and integrity preflight still reports 0 orphans.
- Prisma/TypeScript, 17 API unit tests and PWA asset validation pass. VAPID configuration remains **0/3** and no push notifications were sent. No GitHub commits/pushes, production deployment, or other existing local work changed.
- Detailed evidence: `docs/PWA_PUSH_STAGE1_LOCAL_ACTIVATION_2026-11-16.md`.

## 2026-11-16 — PWA Push Notifications & App Badges (local only)

- **Optional alerts:** Added private browser Web Push for existing inquiry/reply, listing-review and affiliation events. In-app notices are saved first; push delivery is best-effort and disabled unless VAPID keys, schema and per-device consent are present.
- **Account-owned settings:** Added additive `PushSubscription` and `PushPreference` Prisma models, migration, strict endpoint-provider allowlist, per-user notification categories and secure subscription deletion.
- **Web experience:** Added the opt-in settings panel in Notifications, generic lock-screen banners, notification-tap navigation, login return links, unread badge updates and a Messages-only badge on mobile navigation. Message-specific unread badges clear only when the recipient actually observes a message; newer unseen messages remain unread.
- **Privacy:** Never send sender names, message text, listing titles or review reasons to the lock screen; push endpoints are capability secrets and are never cached in the service worker or logged.
- **QA:** Synthetic, isolated MySQL push migration and seven authenticated integration tests pass. New unit tests verify private payloads and service-worker navigation. This change does not apply a development/production migration, install credentials, push GitHub commits, or transmit a real notification. See `docs/PWA_PUSH_NOTIFICATIONS_2026-11-16.md`.


## 2026-11-16 — Listing image security and mandatory content review (local only)

- **Upload hardening:** Authenticated seller ownership/status/quota now checked before accepting file bytes. The server decodes and validates true JPEG/PNG/WebP format, enforces a 3 MiB and 24 MP bound, rejects multi-frame input, removes original temporary files and re-encodes new photos to metadata-free WebP (max 2400px). Added the free Sharp dependency; no external scanning service or DB migration.
- **Approval gate:** Adding a photo to a published listing returns it to draft. Campus reviewers must explicitly confirm inspecting every photo before approving; confirmation and photo count are audited. Seller and reviewer UI explain that pornographic/explicit or otherwise prohibited imagery is not allowed.
- **Security boundary:** No automatic pornography or graphic-content classifier was installed. Existing media are not reprocessed; browser-saved copies of already public media cannot be prevented. See `docs/CONTENT_MODERATION_SECURITY_2026-11-16.md`.
- **Verification:** New sanitizer tests 3/3, reviewer-attestation unit tests 5/5, and existing permission tests 5/5 pass (**13/13 total**); web build passes, and isolated API integration assertions were added. Full API typecheck/integration are blocked by concurrent PWA push-notification code (`web-push` default-import runtime error and stale Prisma client types). No production deployment.

## 2026-11-12 — Mobile UI/UX refinement (local only)

- **Home:** Shortened the decorative hero at 320px from 847px to 508px and at 390px from 682px to 394px. Phone/tablet PWA content now reaches categories and listings sooner; desktop artwork stays intact.
- **Explore:** Mobile All/Products/Services chips, collapsible advanced filters with active count and accurate URL-linked state. One-column controls at 320px stop cramped Campus/Category selection. First visible listing now starts near 529px at 320px and 472px at 390px.
- **Shared UX:** Refined small-phone listing typography/spacing, 48px mobile bottom tabs, compact auth-card spacing and accessible Messages action. All functionality and forest-green styling preserved.
- **QA:** Production build, 5 API unit tests, PWA validation and six Axe Home/Explore/Login scans passed. Browser interaction tests covered filters, reset, zoom, and desktop fallback. See `docs/MOBILE_UI_UX_REFINEMENT_2026-11-12.md` and screenshots under `docs/qa/`. Physical phone acceptance is still pending.


## 2026-11-12 — PWA mobile finalization (local only)

- **App icon:** Replaced the generic C with a custom cream-C/gold-sparkle/forest-green symbol; retained source SVG and dependency-free PowerShell generator. Separate 192/512px normal + maskable icons and 180px Apple touch icon.
- **Install metadata:** Short iPhone home-screen name `CPSU Market`, separate manifest maskable icon entries, three Android launcher shortcuts (Explore/Sell/Messages), and refreshed safe static-icon cache version.
- **Mobile bottom bar:** Preserved Home/Explore/Sell/Messages/Profile and added a subtle selected-tab top marker. Route switching, `aria-current`, keyboard reply behavior, 44px targets, and responsive widths were verified using read-only browser fixtures.
- **QA:** Added `bun run pwa:check`, a 390px simulated mobile screenshot, and `docs/PWA_MOBILE_FINALIZATION_2026-11-12.md`. Chrome found no manifest/installability errors; Android/iOS physical installation remains blocked pending real-device validation. No production deployment or GitHub push.


## 2026-11-12 — Conversation-start listing context (local only)

- **Added:** One compact listing summary at the beginning of each chat history, showing the relevant item's real title, first photo (with fallback), product/service type, price and basis, condition when applicable, availability, and listing ID.
- **API:** Expanded participant-authorized `GET /inquiries/:id/messages` with a whitelisted `listing` object; private listing media is not exposed after a listing becomes unpublished.
- **Preserved:** Existing forest-green PWA theme, message read/delivery receipts, date dividers, typing, presence, handoff flow and permissions. No order/shipping/payment functionality or database migration.
- **QA:** Web build, API TypeScript, 5/5 unit tests, 18/18 isolated API integration tests (130 assertions) and test-database integrity audit passed. Real-device visual and screen-reader checks remain pending; no deployment.

## 2026-11-12 — Unify mobile and web as one responsive PWA

- **Changed:** `apps/web` is the sole mobile/desktop frontend, with installable manifest, icons and a safe offline fallback; `/api/v1` remains same-origin and existing backend permission rules remain authoritative.
- **Retired:** The separate Expo startup command and device-specific `extra.apiUrl` setup. Preserved the existing Expo source (including local WIP changes) under `legacy/expo-mobile` rather than deleting it.
- **Updated:** Bun and npm workspace lockfiles, `README.md`, current system overview, security and testing references, and Nginx manifest/service-worker cache headers.
- **Security:** Removed obsolete Expo `:8081` development CORS exceptions; PWA service worker never caches API responses or private content.
- **Release gate:** Production deployment remains blocked pending real-device and screen-reader acceptance.


**WP2 implementation verification (2026-11-11):** C4 approved and recorded in the blueprint. Local development reports Stage 1 and WP2 migrations applied (4 total). Implemented web seller condition/availability/remove controls, condition filter and pagination; mobile sold/reserved handling; 3 WP2 HTTP regression cases. **17/17 integration tests, 5/5 unit tests; API/web/mobile TypeScript checks and web build passed.** Retained post-migration SQL backup created under the user's private Documents directory. See `docs/WP2_IMPLEMENTATION_REPORT.md`. No production deployment.

**Stage 1 backup/restore drill (2026-11-11):** Added `apps/api/scripts/verify-integrity-restore.ts` and `db:restore-rehearsal` command. Dumped current local development DB to temporary private SQL, restored 20 tables / 402 rows with matching SHA-256 content, applied 19 FKs plus index to restored copy and confirmed no changed rows; temporary SQL/database removed. No deployment migration. See `docs/STAGE1_RESTORE_DRILL_REPORT.md`.

**Stage 1 isolated migration rehearsal (2026-11-11):** Prepared separate Prisma schema and 20-statement additive SQL candidate; sandbox migration passed data-preservation and foreign-key checks. The canonical Prisma schema, deployed migration history, development DB and production DB were not modified. See `docs/STAGE1_SANDBOX_MIGRATION_RESULTS.md`.

## 2026-11-11 — Stage 1 read-only integrity preflight

**Added** — `apps/api/scripts/integrity-preflight.ts`, `db:integrity-preflight` command, and `docs/STAGE1_DATABASE_INTEGRITY_APPROVAL.md` with migration candidates and approval gates.

**Verified** — local development database read-only audit: 19 selected FKs missing, 0 orphan references, no proposed discovery composite index; 14 integration tests and 5 unit tests green, API typecheck clean. No application database schema/data migration performed.

## 2026-11-11 — Stage 1 isolated test foundation

**Added** — guarded integration runner, dedicated local MySQL test database provisioning, repeatable fixtures, Supertest route tests (14 cases), read-only schema constraint/index audit, and `docs/STAGE1_TESTING_REPORT.md`.

**Verified** — 14/14 integration tests, 5/5 unit tests, clean API typecheck. No main application schema migration, route change or WP2 implementation. Remaining discovery index and foreign-key repairs require owner approval.


Format: date, then added / changed / fixed / docs. Dates are the dates the work was recorded in this repository.

## 2026-11-11 — Storefront UI/UX redesign (web and mobile)

**Changed**
- Web home follows the supplied storefront reference: announcement strip, light search-led masthead (brand mark, activity icons, theme
  control), nav row with an "All listings" pill, hero with listing photos and a "Direct — you deal with the seller" sticker, horizontal
  category rail, a curated first rail ("Popular listings", or "Browse listings" while nothing is popular yet), three promo tiles, "Fresh
  listings", "Student services", "How it works", a seller call-to-action band, a four-item trust strip and a four-column footer. The header
  is no longer an always-dark bar.
- Listing cards gained a category badge over the photo, seller and campus lines, and a price tag with a detail arrow.
- Header search submits to Explore, and Explore now seeds its filters (query, campus, category, type, min/max price, sort) from the URL and
  re-seeds when the parameters change, so footer links and promo tiles land on real filtered results.
- Mobile home mirrors the same order with native primitives: masthead + announcement strip, hero, circular category rail, two-column card
  grid, promo tiles, how it works, CTA band, trust strip and footer. Explore, Saved and the shared list screens use the same card in a
  two-column grid. Mobile theme gained `mint`, `onMango`, `forest` and `forestInk` for light-on-dark surfaces.

**Deliberately not copied from the reference** — cart/checkout, discount and struck-through prices, star ratings, "free shipping" and
"30-day returns" claims, the newsletter form and written testimonials. Each needs data or a feature the MVP excludes (payments, a
compare-at price, listing reviews, an email endpoint). The social-proof row became "How it works" and the newsletter band became the seller
call to action.

**Verified**
- Web: typecheck clean; build 17.22 kB CSS / 214.27 kB JS. In the running app at 1400 px: 3 strip items, search in the masthead, 5 nav
  links, 9 category tiles, 3 promo tiles, 3 steps, 4 trust items, 3 footer navs with 12 links, `scrollWidth - clientWidth = 0`.
- Mobile: typecheck clean; `expo export --platform web` bundled 432 modules (682 kB). The exported app was then loaded at a 420 px viewport
  and the masthead, hero, category rail and rails render as designed.
- Fixed during verification: "Fresh listings" and "Student services" repeated cards from "Top picks" (on this catalogue the services rail was
  an exact subset), so the services rail drops anything already shown above it and a section with nothing left disappears;
- The mobile home now matches the web storefront in detail: the hero carries the web copy ("Great finds. Right on campus."), two actions,
  live listing photos and the "From students" sticker; the category rail has an "Explore by category" heading and "View all" tile styling;
  promo tiles pass their own filter (services, products) into Explore; cards show a Service/Product tag, category and condition, and a bold
  price; the seller band gained its eyebrow and the footer its two link groups. Explore accepts a listing type and shows it as a removable chip.
- Marking a listing sold now asks for confirmation first. Sold is final in v1 (the listing leaves public search and cannot be relisted),
  so a mis-picked option must not end a listing silently; cancelling the prompt leaves the previous availability selected. The mobile
  app has no availability control in this version, so there is nothing to mirror there. and a percentage `maxWidth` on the mobile card is ignored by React Native Web, which squeezed four cards into one row
  — grid tiles are now sized from the window.
- Not verified: no Android/iOS device or emulator run; web visual review was limited to a phone-width capture, with desktop geometry checked
  numerically rather than visually.

## 2026-11-11 — Typography: Plus Jakarta Sans + Inter

**Changed**
- Replaced Bricolage Grotesque / Public Sans with **Plus Jakarta Sans** (`--font-heading`, 400–800) for `h1`–`h3`, the brand and price
tags, and **Inter** (`--font-body`, 400–700) for everything else. The Google Fonts link requests exactly those weights.
- Renamed the display token from `--font-display` to `--font-heading` to match the supplied snippet; every `var()` use updated.

**Verified**
- `h1` and `.brand` compute to `"Plus Jakarta Sans", system-ui, sans-serif`; body, labels and controls to `Inter, system-ui, sans-serif`.
- Both families report loaded in `document.fonts`, including the 800 heading weight used by `h1`, the brand and `.tag`.
- Web typecheck clean; build succeeded (8.73 kB CSS, 204.82 kB JS).

**Note**
- The first check looked like a failure: the dev server was still serving pre-rename CSS, so `h1` fell back to Inter. The built CSS was
  correct; touching the file forced Vite to re-transform it.
- The native app still uses the platform font. Adopting these faces there needs `expo-font`, so it was not part of this change.

## 2026-11-11 — Colour palette: five-colour system, light and dark

**Changed**
- Adopted the supplied palette as the single source of colour: `#0E2815` forest, `#295740` pine, `#537D5D` sage, `#E0BB46` gold,
  `#B0D3C2` mint. Web `:root` exposes them as `--forest/--pine/--sage/--gold/--mint` next to the semantic tokens.
- Light scheme: forest text, pine primary actions with white labels, gold price tags and badges with forest labels, mint-tinted surfaces.
- Dark scheme: forest page, lifted pine cards, mint text and primary actions with forest labels, the same gold accent.
- Added `--on-leaf` and `--on-mango` so a label's colour always matches the surface under it; removed the dark-only `.btn` override that
  hard-coded near-black text.
- Mobile `theme.ts` carries the same tokens, including a new `mangoSoft`; the two hard-coded `#fdebc6`/`#1b2838` uses in `App.tsx` now read
  from the theme.
- `index.html` `theme-color` metas follow the new palette in both schemes.
- Three-state theme control in the header (`Auto` → `Light` → `Dark`) writing `data-theme` on `<html>` and persisting to `localStorage`
  (`cpsu.theme`). An inline script applies a saved choice before first paint to avoid a wrong-scheme flash.

**Fixed in the same pass**
- The bar's filled button inherited the bar's link colour, so in dark mode "Create account" was `#E8F2EB` on mint — **1.42:1**, unreadable.
  `header.top .btn:not(.ghost)` now labels it from `--on-leaf`: 9.71:1 dark, 8.3:1 light.

**Verified**
- Web and mobile typechecks clean; `bun run build` succeeded (8.74 kB CSS).
- Contrast measured from computed styles in the running app: body 14.8:1 light / 13.75:1 dark, muted 7.1 / 8.4, header 14.8 / 15.33,
  price tag 8.53, primary button 8.3 / 9.71. All clear 4.5:1.
- Toggle cycle measured: `Auto` (no attribute) → `Light` (`data-theme=light`, page `#F4F9F6`) → `Dark` (`data-theme=dark`, page `#0E2815`),
  and `dark` survives a reload from `localStorage`. No horizontal overflow at 400 px.
- Explore viewed in light and dark at 400 px.
- Mobile was not re-checked visually; its tokens mirror the web values and only typecheck was run.

## 2026-11-11 — Explore enhanced (web)

**Added**
- `sort` query parameter on `GET /api/v1/listings`: `newest` (default), `price_asc`, `price_desc`, validated against a fixed set so no client
  string reaches the query builder.
- Explore filter grid with visible labels: search, campus, category, type, minimum price, maximum price, and a Clear filters button that appears
  only when a filter is active.
- Result bar showing the true total (`N listings`, `No listings match`, `Searching…`) with a live-region announcement, plus a sort selector.
- Purposeful empty state that distinguishes "filters too narrow" from "nothing published yet", with a reset action.
- Listing card now separates the seller from the category · campus line.

**Changed**
- On screens ≥ 900 px the bottom tab bar is centred at a fixed width instead of stretching across the window.
- The top bar now uses fixed light-on-dark colours instead of the theme tokens. In dark mode it inherited `--chalk` (near-black)
  on a near-black bar, which made every navigation link unreadable; the ghost `Sign out` button also takes a light edge.
- Below 700 px the header hides Explore, Guidelines, Saved, Inquiries and My store (`.sec`) so six links stop wrapping onto three
  lines; the tab bar still reaches all five primary destinations.

**Verified**
- `sort` returns `200` for all three values and `400 validation_error` for `sort=evil`; price range and sort combine.
- API and web typechecks clean, API tests 5/5, web build succeeded (204 kB JS / 64 kB gzip, 8.09 kB CSS).

**Limitation**
- Ordering across multiple rows could not be demonstrated: the dev database has one published listing.
- No paging controls yet (KI-033): Explore requests the first 20 rows while the result bar reports the true total, so above 20
  listings the count and the visible rows disagree.

## 2026-11-11 — Expo web target fixed (mobile display)

**Fixed**
- `expo start --web` could not bundle: `Unable to resolve "react-native-web/dist/exports/AppRegistry"`. Installed the SDK 52
  matched web dependencies with `expo install`: `react-native-web@0.19.13` and `@expo/metro-runtime@4.0.1`.
- Startup uncaught exception on web: `expo-secure-store` has no web implementation, so the first `refresh()` threw. Token storage now goes
  through a `keychain` wrapper in `apps/mobile/src/api.ts`; on web the session stays in memory (native builds keep the OS keychain).
- The mobile web target called `http://10.0.2.2:4000` — an Android-emulator alias that no browser can reach. The base URL now derives
  from the browser hostname on web.
- The API refused Expo's origin because `CORS_ORIGINS` allowed only Vite's 5173. `apps/api/src/app.ts` now adds
  `http://localhost:8081` and `http://127.0.0.1:8081` **in development only**; production keeps the configured allowlist.
- The bottom tab bar rendered duplicated placeholder glyphs ("⏷⏷") before every label; `tabBarIcon: () => null` removes them.
- Listing detail appended `priceBasis` verbatim, so a listing stored with basis `"1"` read "PHP 150 1" while the Explore card read
  "PHP 150". Both clients now show a basis only when it contains a word ("per item", "per hour") (KI-032).

**Changed**
- `apps/mobile/package.json` gained `react-native-web` and `@expo/metro-runtime` (web target only; native entry points unchanged).

**Verified**
- `bunx expo export --platform web` → success; dev bundle compiled 435 modules / 2.9 MB with no resolution error.
- Expo web preview: Home rendered live listings, category chips and the recently-added section; API preflight returned 204 and
  `GET /listings`, `/categories` and `/media/:id` returned 200.
- `cd apps/mobile && bunx tsc -p tsconfig.json --noEmit` → clean; `bunx tsc -p apps/api/tsconfig.json --noEmit` → clean.

**Not verified**
- Native iOS/Android builds were not run; only the web target was exercised.

## 2026-11-11 — UI/UX update: navigation, Profile, notification centre

**Added**
- `apps/web/src/pages-profile.tsx`: Profile (identity, affiliation state, account settings with display-name editing, marketplace links) and
  Notifications (unread markers, relative time, mark-all-read, loading skeleton, empty and error states).
- Web header "Alerts" link with an unread count badge fed by the existing `/notifications` endpoint.
- Mobile Home tab (intro, search entry, category chips, recently added, student services) and a `Chip` component shared with Explore.
- Mobile notifications section in Profile with mark-all-read, plus Saved listings as a stack screen.
- `timeAgo()` helper and a `not_found` message in the web API layer.
- Design-system additions: `.page-head`, `.profile-grid`, `.facts`, `.quick`, `.notif`, `.nav-badge`, `label.field`, and status badges for
  `verified`/`approved`/`pending`/`cancelled`.

**Changed**
- Web primary navigation is now the blueprint's five destinations (Home, Explore, Sell, Messages, Profile); `/profile` and `/notifications`
  are signed-in routes.
- Web tab bar spacing reduced so five destinations fit a 360 px screen.
- Mobile tabs are Home, Explore, Messages, Profile; Categories folded into Explore's chips and Saved moved under Profile, per PART VI.
- `Me` type on web now includes `email` (already returned by `/me`) for the Profile page.

**Fixed**
- Notifications were written by the API but had no surface anywhere; the core event types are now readable on both clients (KI-003).
- Web had no Profile destination and mobile had no Home (KI-027, partially).
- **Session loss on hard reload (KI-029).** A signed-in page's mount-time request and the shell's session restore each refreshed the token;
  the API rotates tokens and treats a second use as theft, so it revoked every session and the page showed `unauthenticated`. Web refresh
  is now single-flight, and Saved, Messages and Notifications wait for the restored session before fetching.

**Verified**
- `bunx tsc -p apps/web/tsconfig.json --noEmit` → clean.
- `cd apps/mobile && bunx tsc -p tsconfig.json --noEmit` → clean (dependencies installed at the workspace root).
- `bunx tsc -p apps/api/tsconfig.json --noEmit` → clean; `bun test` → 5 passed.
- `cd apps/web && bun run build` → success, 35 modules, 202 kB JS / 64 kB gzip, 6.98 kB CSS.

**Not changed**
- No API route, Prisma model, migration, or dependency was modified. Admin navigation, transaction UI, and the mobile Sell/Offer composer
  remain open (KI-027, `docs/MVP_SCOPE.md`).

## 2026-11-11 — Documentation baseline

**Added**
- `MASTER_BLUEPRINT.md`: the approved v1.0 blueprint, archived as the single source of truth (RULE 01).
- `docs/SYSTEM_OVERVIEW.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/NON_FUNCTIONAL_REQUIREMENTS.md`, `docs/BUSINESS_RULES.md`,
  `docs/USER_ROLES_PERMISSIONS.md`, `docs/DATABASE_DESIGN.md`, `docs/API_DOCUMENTATION.md`, `docs/UI_UX_GUIDELINES.md`,
  `docs/SECURITY_GUIDELINES.md`, `docs/TESTING_STRATEGY.md`, `docs/MVP_SCOPE.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/CHANGELOG.md`.
- `progress/IMPLEMENTATION_STATUS.md`, `progress/KNOWN_ISSUES.md`, `progress/DEVELOPMENT_LOG.md`.

**Changed**
- None. No application source, schema, migration, dependency, or configuration was modified in this entry.

**Verified**
- `cd apps/api && bun test` → 5 passed, 0 failed.
- `bunx tsc -p apps/api/tsconfig.json --noEmit` → clean.
- `bunx tsc -p apps/web/tsconfig.json --noEmit` → clean.
- `cd apps/api && bunx prisma migrate status` → 2 migrations applied, schema up to date.
- Mobile typecheck not run: `apps/mobile/node_modules` absent.

**Recorded, not resolved**
- Eight scope conflicts (C1, C1a, C2, C3, C4, C5, C6, C7) in `docs/MVP_SCOPE.md` §4, awaiting owner approval.
- Six missing MVP features (014, 015, 020, 022, plus the missing halves of 016 and 024) and twelve partial ones.

## 2026-11-10 — Pilot implementation (initial)

Reconstructed from migrations `20261110063101_init` and `20261110090354_message_status` and file timestamps.

**Added**
- Express + Prisma + MySQL API: authentication with rotating refresh sessions, campus affiliations, seller stores, product/service listings,
  image uploads, submit-for-review, campus-scoped review with reasons and policy versions, inquiry threads, handoff records, reports,
  notifications, audits, analytics with small-count suppression.
- React + Vite web client: home, explore, listing detail, store page, guidelines, auth, store dashboard, inquiries, saved, review queue.
- Expo mobile client: explore, categories, listing detail, inquiries, saved, profile, auth.
- Nginx, systemd unit, and database+media backup script under `infrastructure/`.
- Pilot design docs: `docs/architecture.md`, `docs/roles-and-permissions.md`, `docs/campus-policy-rules.md`, `docs/privacy-and-retention.md`.
- Five authorization unit tests.

## 2026-11-12 — Notifications experience refinements

- **Changed:** `/notifications` now has a forest-green unread summary, All/Unread controls, Today/Yesterday/Earlier groups, distinct notification categories, readable summaries, and separated View/Mark read actions.
- **Fixed:** Initial loading failures no longer appear as an empty inbox; failed refreshes preserve already loaded notifications. Unknown/unclickable notifications can be marked as read individually. Action and refresh feedback is announced without a toast dependency.
- **Accessibility:** 44px touch targets, keyboard focus, filter pressed state, one contextual status message, and reduced-motion support.
- **Verified:** Frontend build; headless responsive and interaction tests at 320–1440px with mock notification payloads. Backend contracts, database, permissions, and production records unchanged; physical-device and screen-reader acceptance remain open.

## 2026-11-17 — Messaging closure safety, isolated database verification
- **Tested:** End conversation with two synthetic student accounts in the guarded local MySQL test DB. Four new HTTP/MySQL cases and five simultaneous send/close races. Existing Stage 1 36, report safety 4, conversation 4 all passed.
- **Fixed:** After a thread is closed, `/typing` and `/presence` now reject with `409 thread_closed`; thread reads suppress stale status from racing heartbeats. History and message read acknowledgements remain available.
- **Validated:** API unit 103 passed (six opt-in skips); web 42 passed; API typecheck, web build and PWA validation passed. No schema migration, external service changes, production data writes, commit or deployment. Device/browser and full concurrency stress acceptance remain pending.
- **Details:** `docs/CONVERSATION_SAFETY_B1_MYSQL_2026-11-17.md`.

## 2026-11-17 — B1.3 bounded concurrency QA and B2 approval preparation
- **Added:** 4-case opt-in test suite with 40 send/close races, 20 double-close races, 10 blocked replay waves and rate-limit regression, running sequentially in local `cpsu_marketplace_test`.
- **Passed:** 48 isolated MySQL test cases (36 Stage 1, 4 reports, 4 B1.2 close, 4 stress); 104 ordinary API tests (7 gated skips); 42 web tests; typecheck, build, PWA, git diff.
- **Observed:** 31 explicit 409 concurrency conflicts under deliberately overlapping operations; no duplicate closure audits or messages after close. A benign but meaningful release UX follow-up is bounded retry of **idempotent close only** (not sends).
- **Blocked:** physical Safari QA (firewall disabled on all three profiles; Wi-Fi Public). Readiness-only preflight; no listener started or OS security changed.
- **Documented:** separate CPSU owner/DPO decision matrix for durable blocking and private-message reporting; no schema, private-message evidence access or endpoints activated.
