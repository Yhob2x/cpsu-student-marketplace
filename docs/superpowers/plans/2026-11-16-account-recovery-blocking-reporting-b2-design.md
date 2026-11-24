# Package B2 — Account Recovery, Blocking, and Private Conversation Reporting (Design Only)

**Status:** Awaiting institutional policy, security, privacy, schema-migration, and test approvals. NO production endpoints, reset delivery, blocklists or private-message access are activated by this document.

**Reference:** `MASTER_BLUEPRINT.md` Module 01 and Module 06; `docs/SECURITY_GUIDELINES.md`, `docs/privacy-and-retention.md`.

## A. Password recovery — recommended secure design

**User journey:** Student clicks *Forgot password*, enters existing registered email, receives a uniform message whether the account exists or not, then gets an approved time-limited, single-use recovery method. After successful recovery, old refresh sessions are revoked; fresh sign-in is required.

**Data:** Dedicated hashed reset-token record (user id, SHA-256 hash of high-entropy random token, expiresAt, consumedAt, createdAt), never raw token in database, analytics or server logs. Restrict TTL (recommend 20 minutes), rate-limit issuance and redemption by IP and account; audit successful redemption and failures without logging secrets. Do not use student ID photos, hardcoded override codes, or answers to guessable questions.

**Decisions before implementation:** CPSU-approved secure recovery transport (trusted email domain/provider, or supervised campus identity verification with an auditable one-time code); how to verify account email ownership; DPO-approved message retention and account recovery policy. If no approved private delivery channel exists, **do not enable self-service resets**. Avoid an interface that pretends a reset was sent.

**Tests:** unknown/known email response indistinguishable; expiry, token reuse, hash-at-rest, theft, rate limits, session revocation and CSRF assumptions; never echo tokens in error/logging.

## B. Student blocking — recommended durable data model

Proposed additive `UserBlock` relation: `blockerUserId`, `blockedUserId`, `createdAt`, optional `unblockedAt` and audit actor; UNIQUE blocker/blocked pair; forbid self-block; indexed inverse lookup. Use database-side authorization in **both** `POST /inquiries` and `POST /inquiries/:id/messages`. Block all new chat/contact between the pair, including different listings, regardless of which party is buyer or seller. Stop new presence/typing disclosure and related incoming notifications; keep evidence/history unless retention policy mandates removal.

**Policy choices:** Is blocking unilateral without notification? Recommended: yes. Existing transaction state/history remains visible; decide whether transaction status changes are permitted and whether campus moderation may mediate already-accepted obligations. Define unblock semantics and whether a user can prevent recontact from previously blocked users on re-registration. Never treat *End conversation* (Package B1) as a global user block.

**Tests:** block both directions and all listings; self-block forbidden; forged user id cannot bypass authorization; blocked user cannot infer private block details from distinct error codes; unblock notifies no one without policy; existing transactions remain within their existing access controls; idempotency and concurrent requests.

## C. Conversation/user reporting — recommended evidence and scope

Extend `Report` with a **typed target** (conversation, message, or user) by additive optional relations to `InquiryThread`, `InquiryMessage`, and reported user, rather than disguising a conversation complaint as a listing complaint. The server validates that the reporter participates in the thread, the message belongs to it, and the reported actor is the *other* participant; campus reviewer scope comes from the related listing's campus. Staff access to private message content must be an explicit DPO-approved, audited, least-privilege workflow. Default: no general staff inbox access.

**Evidence policy decisions:** Whether only the specifically reported message can be disclosed, whether to retain an immutable excerpt, whether reporter acknowledgement/consent is required, applicable retention and evidence minimization, what appeal/identity-review process exists, and escalation of urgent threats. Reviewer actions (reviewing, dismissed, resolved, referral/escalation) need actor/reason/time and campus scoping. No automatic punishment from a report.

**Tests:** unauthorized nonparticipants return 404; reviewer cross-campus denial; no unrelated message content/attachments exposed; reported message and actor belong to thread; no spoofed sender, state audit, rate limits, retention and appeal handling.

## D. Affiliation consistency decision

**Current code reality:** Registration immediately permits inquiries for active student accounts. Seller publication and purchase requests require verified affiliation. The blueprint's goal is a verified university community. Pick one and explicitly approve:

- **Option A (recommended for verified-only campus rollout):** require valid verified affiliation for **all** new inquiries and chat replies, with clear pending-verification UI, plus re-review when affiliation expires.
- **Option B:** permit student accounts awaiting verification to message, but not transact/sell, with explicit anti-abuse limits and a clearly stated exception in the blueprint.

Changing this is a *business authorization policy change*, not just a frontend fix.

## E. Release plan and gates

1. CPSU product owner approves A-D policy choices and clear definitions of blocking/reports.
2. CPSU DPO/authorized privacy officer approves email/recovery transport, private-message evidence scope, retention, abuse disclosures and appeal routing.
3. Produce reviewed additive Prisma migrations with matching permissions, backfill plan, rollback/restore evidence, no silent production mutations.
4. Implement server-side authorization and abuse/rate-limit protections first; then UX with accessible states and mobile constraints.
5. Run synthetic isolated DB integration, denied-role/cross-campus/IDOR tests, regression/unit/build checks and real-device browser QA.
6. Apply only via the project's authorized migration and production-deployment gates; do not install outside services without explicit decision.

**Not approved:** automatic content adjudication, third-party auth, payment collection, public ID uploads, unrestricted reviewer access to all chats or any production database migration.
