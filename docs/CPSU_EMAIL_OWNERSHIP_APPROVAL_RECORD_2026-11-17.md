# CPSU Market — Email ownership and campus eligibility decision record

**Record ID:** CPSU-SEC-EMAIL-01 | **Version:** 1.0 working draft | **Prepared:** 2026-11-17
**State:** PROPOSED / AWAITING CPSU APPROVAL — no email was sent, no account or schema was modified.

## What this control must and must not prove
- **Email ownership:** The registering person can receive a one-time verification link at the stated mailbox. This is **not** a university enrollment determination.
- **Campus affiliation:** An authorized CPSU reviewer independently confirms the student's active campus eligibility. Email-domain possession must **not** automatically mark `Affiliation` verified.
- **Authorization:** An active account plus any CPSU-approved combination of email-ownership and affiliation state is required before sensitive buyer/seller functions. Suspended students remain denied.

## Institutional decision authority
- Student registration and eligibility policy: **PENDING CPSU OFFICE**
- Approved sender, mail transport and service ownership: **PENDING CPSU IT**
- Bounce/complaints/contact support owner: **PENDING**
- DPO, retention and processor review: **PENDING**
- Effective date, institutional email domains and extension-campus exceptions: **PENDING**

## Decision table — design proposal, not active policy
| ID | Policy point | Proposed design | CPSU decision |
| --- | --- | --- | --- |
| EMAIL-01 | Allowed addresses | Use a mailbox the user controls; university-domain-only vs personal email and students lacking university mail must be explicitly decided | **PENDING domains / exceptions / eligibility proof** |
| EMAIL-02 | Sender and transport | CPSU-controlled domain and authenticated mail provider/SMTP, secret kept server-side, approved sending volume and monitored bounces | **PENDING sender, transport, data processing review** |
| EMAIL-03 | Registration state | Create restricted unverified-email account, then issue time-limited, single-use verification; no privileged actions until verified | **PENDING permitted browsing and exact restricted routes** |
| EMAIL-04 | Token controls | Strong random one-time token, store only hash, redeem once atomically, expire in **proposed 30 minutes**, invalidate on address change; HTTPS-only allowlisted origin | **PENDING time limit and technical values** |
| EMAIL-05 | Resend and anti-abuse | Uniform responses regardless of address existence, IP/account rate limiting, cooldown and bounded attempts; no tokens in logs | **PENDING exact limits and support escalation** |
| EMAIL-06 | Address changes | Re-verify new address before use; protect change with existing session plus fresh authentication, notify old address where feasible | **PENDING whether old address retained and duration** |
| EMAIL-07 | Campus eligibility | Independent verified, unexpired campus affiliation for selling, listing review-submission and transaction flows; resolve whether initial buyer messaging/favorites also require it | **PENDING role × action matrix / exception cases** |
| EMAIL-08 | Existing accounts | Explicit grandfathering, migration and enforcement timeline; existing sessions must not silently receive verified-email status | **PENDING conversion / outreach plan** |
| EMAIL-09 | Accessibility and recovery | Plain-language localized instructions, accessible links, expired-link handling, non-webmail support channel and protected corrections | **PENDING campus support office** |
| EMAIL-10 | Retention | Keep minimal verification metadata and rate-limiting evidence only for DPO-approved period; exclude raw tokens from logs, analytics and tickets | **PENDING retention decision record** |

## Eligibility matrix for CPSU to approve
| User situation | Proposed safe behavior | CPSU acceptance |
| --- | --- | --- |
| Guest | Public browse only (subject to CPSU marketplace access rules) | **PENDING** |
| Signed in, email **unverified** | Limited account/verification guidance; cannot trade, create listings, initiate restricted inquiries or acquire staff privileges | **PENDING** |
| Email verified, campus **unverified/expired** | May access approved nontransactional functions only; cannot sell, submit requests or perform restricted actions | **PENDING exact buyer functions** |
| Email verified, campus verified, account active | Student features according to existing server-side roles, campus and listing checks | **PENDING** |
| Suspended or staff account | Cannot use student trading actions regardless of email state | Existing authorization rules remain; **PENDING cross-check** |

## Acceptance prior to implementation or release
1. CPSU selects an operational mail transport, institutional sender, real support channel and approved data-processing arrangement. No test email from a personal address is claimed here.
2. Approved additive user/token schema and migration, with handling for existing accounts, all reviewed separately. Enforce gate on the **server**; registration refresh must not grant full functionality before verification.
3. Test one-time token race, expiry, tampered link, resend limits, domain mismatch, shared mailbox risk, account enumeration, address-change invalidation and mail outage/retry.
4. Test independent campus reviewer approval (including extension campuses), expired affiliation, revoked/suspended account, all student purchase/sell/message routes and full browser sign-in flow.
5. Accessibility, mobile delivery, link routing in PWA, privacy notice, audit redaction and logout/recovery verified on synthetic accounts only.

## Authorization record
**Decision:** [ ] APPROVED AS WRITTEN [ ] APPROVED WITH CHANGES [ ] RETURNED [x] NOT YET APPROVED

Registrar/student-affairs representative/date: ____________________
CPSU IT/mail operations/date: ____________________
DPO/privacy/date: ____________________
Security and implementation owners/date: ____________________
Approved domain(s), route matrix and mail provider: **PENDING**
**Gate status:** BLOCKED. Mail delivery and student eligibility decisions have not been approved.

**Source baseline:** MASTER_BLUEPRINT.md Module 01; docs/BUSINESS_RULES.md; docs/SECURITY_ASSESSMENT_BATCH_2026-11-17.md.
