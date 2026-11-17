# Security and data privacy guidelines

Blueprint PART IX is the requirement; this file records what the code actually enforces and what remains before any production launch.
Not legal advice — CPSU's data protection officer must review (`docs/privacy-and-retention.md`).

## 1. Controls implemented

| Control | Implementation | File |
|---|---|---|
| Password hashing | Argon2id, random salt per hash | `src/auth.ts` |
| Password policy | 10–128 characters | `routes/auth.ts` |
| Credential stuffing limit | 30 `/auth` requests per 15 min in production; 300/min/IP overall | `app.ts` |
| Access tokens | JWT, 15-minute expiry, HS256 with `JWT_SECRET` ≥ 32 chars | `src/auth.ts`, `src/env.ts` |
| Refresh tokens | 48 random bytes, stored only as SHA-256 hash, 30-day expiry, rotated on every use | `routes/auth.ts`, `Session` |
| Token-reuse detection | Presenting a spent refresh token revokes **all** of that user's sessions | `routes/auth.ts` |
| Cookie hardening | `httpOnly`, `SameSite=Lax`, `Secure` when `COOKIE_SECURE=true`, narrow paths (`/api/v1/auth`, `/api/v1/media`) | `routes/auth.ts` |
| Unified browser/PWA sessions | HttpOnly refresh cookies and in-memory access token, same as desktop web; no cached private user data | `apps/web/src/api.ts`, `apps/web/public/sw.js` |
| Authorization | Roles read from the DB per request; no client-supplied role, campus, or owner id is trusted | `src/auth.ts`, `permissions.ts` |
| IDOR resistance | Ownership joins; out-of-scope resources return `404` | `routes/seller.ts`, `routes/inquiries.ts`, `routes/admin.ts` |
| SQL injection | Prisma parameterized queries only; no raw SQL | throughout |
| XSS | React escaping; no `dangerouslySetInnerHTML`; JSON responses | throughout |
| Input validation | Zod schemas on every mutating route and on query strings; length and range caps | `routes/*` |
| Request size limits | JSON ≤ 100 KB, one upload ≤ 3 MB | `app.ts`, `routes/seller.ts` |
| Upload validation | Pre-upload ownership/status/quota checks; JPEG/PNG/WebP declared-type allowlist **and decoded-format match** via Sharp; 3 MB / 24 MP / single-frame limits; resize to 2400 px maximum, metadata-stripping WebP re-encoding, random filename, untrusted temporary file cleanup, `nosniff` on serve. Applies to **new** uploads. | `routes/seller.ts`, `src/upload-security.ts`, `routes/public.ts` |
| Photo content review | Listings remain unpublished until campus review. Reviewer must explicitly attest to inspecting every photo and their confirmation/count is audited. Adding a new photo to an already published listing returns it to draft for re-review. | `routes/admin.ts`, `routes/seller.ts`, `apps/web/src/pages-admin.tsx` |
| Media access control | Published media public; otherwise owner or in-scope reviewer only. Optional private Google Drive storage uses a server-only OAuth grant, app-owned folder, checksum verification, and the same access-controlled image endpoint; disabled by default | `routes/public.ts`, `src/media-storage.ts`, `src/google-drive-storage.ts` |
| Security headers | `helmet` defaults; cross-origin resource policy relaxed for images | `app.ts` |
| Error hygiene | Typed JSON errors; unexpected errors log server-side and return `500 internal_error` with no stack trace | `src/http.ts` |
| Audit trail | Actor, action, target type/id, JSON metadata, timestamp for every privileged action | `src/audit.ts` |
| Analytics privacy | Counts of 1–4 suppressed as `<5` so a single student cannot be identified | `routes/admin.ts` |
| Public report integrity | Only one public target, positive ID, visible/approved status, not reporter-owned; creation + audit are atomic | `src/report-safety.ts`, `routes/account.ts` |
| Data minimization | No student ID images, phone numbers, schedules, or exact location collected; public payloads whitelisted | `routes/public.ts`, `docs/privacy-and-retention.md` |
| Suspended-account exclusion | Non-`active` users fail authentication on every request | `src/auth.ts` |

## 2. Gaps that block production

| # | Gap | Risk | Recommended fix |
|---|---|---|---|
| S1 | No password recovery | Locked-out students need manual DB edits | Time-limited single-use reset tokens, hashed at rest, emailed through an approved transport; revoke sessions on reset |
| S2 | No CSRF token | Low today — mutations require an in-memory Bearer token, and the refresh cookie is `SameSite=Lax` | If the refresh cookie is ever used for mutations, add a double-submit CSRF token |
| S3 | Pornography/graphic-content recognition is **not automatic**; a human reviewer must inspect uploaded photos | A reviewer could miss harmful imagery or intentionally provide a false confirmation; private uploads still exist before review | Evaluate a locally hosted content-classification model and a safe manual appeal/review path; test false positives and negatives with approved synthetic datasets. Do not claim automatic NSFW detection without validated model and rollout. |
| S3a | Existing pre-hardening photos were not re-encoded | Previously stored files may retain metadata or invalid content | Separately audit and reprocess legacy media with backups, authorization and institutional approval before production. |
| S4 | No per-account lockout or captcha | Distributed credential stuffing is only throttled per IP | Per-account attempt counter plus an alert |
| S5 | Audit rows are mutable by anyone with DB access | Audit trail is not tamper-evident | Append-only DB grants, or a hash chain / write-once store |
| S6 | No session management UI or per-device revocation | Users cannot drop a stolen device | List and revoke `Session` rows from `/me` |
| S7 | No retention or deletion job | DPA 2012 retention obligations unmet | Agreed schedule, a scheduled purge for expired affiliations/media/notifications, and account deletion |
| S8 | Secrets in `.env`; no rotation procedure | Leak blast radius | Documented rotation, separate per-environment secrets, never committed (`.gitignore` already excludes `.env`) |
| S9 | TLS termination depends on the Nginx config being deployed correctly | Plaintext sessions if misconfigured | Enforce HTTPS redirect + HSTS at the proxy; `COOKIE_SECURE=true` in production |
| S10 | Rate limiting is in-process | Multi-instance deployments bypass limits | Shared store (e.g. Redis) or proxy-level limiting |
| S11 | No account suspension capability | A reported abusive account cannot be stopped | Admin suspend/reactivate with audit + notification |
| S12 | No dependency or secret scanning in CI | Supply-chain risk | Add `bun audit`/Dependabot and secret scanning |
| S13 | Staff access to private messages is undecided | Privacy exposure if enabled casually | Define conditions in policy **before** building any moderation view of threads |

## 3. Data handling rules for contributors

1. Never display student IDs, personal email addresses, phone numbers, schedules, or precise location on public pages.
2. Never log tokens, passwords, or full request bodies containing them.
3. Never widen `publicListing()` without checking the field is safe for anonymous visitors.
4. Every new privileged endpoint gets: `requireAuth` or `requireReviewer`, a campus/ownership check, a Zod schema, and an `audit()` call.
5. Every new table that stores personal data needs a retention note in `docs/privacy-and-retention.md`.
6. When in doubt, return `404` for out-of-scope records rather than `403`.
