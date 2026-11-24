# CPSU Market — Staff MFA institutional decision record

**Record ID:** CPSU-SEC-MFA-01 | **Version:** 1.0 working draft | **Prepared:** 2026-11-17
**State:** PROPOSED / AWAITING CPSU APPROVAL — not effective policy, not implemented, not a release sign-off.
**Scope:** Campus reviewer, university administrator, system administrator and any other account receiving privileged staff capabilities. Actual role assignments are server-side; no student role is promoted by enrollment.

## Decision authority (to be completed by CPSU)
- Institutional policy owner: **PENDING NAME / OFFICE**
- Security lead approving implementation: **PENDING**
- Student-affairs / campus eligibility owner: **PENDING**
- DPO/privacy reviewer: **PENDING**
- Accessibility / staff support owner: **PENDING**
- Approval date, policy version and effective date: **PENDING**
- Approved alternative/exception process: **PENDING; no exception granted in this draft**

## Decision table — recommendation, not authorization
| ID | Topic | Proposed control | CPSU final decision / owner |
| --- | --- | --- | --- |
| MFA-01 | Enforced population | Require MFA for every staff role before issuing or using a privileged staff session, including reviewer decisions, account management, reports and audit-log access | **PENDING** |
| MFA-02 | Factor type | Prefer phishing-resistant WebAuthn/passkeys where supported; allow authenticator-app TOTP as a documented fallback. Email-only codes, SMS and knowledge questions should not be the sole privileged second factor | **PENDING supported factor(s)** |
| MFA-03 | New staff enrollment | An authorized staff administrator assigns the role after offline CPSU employment/appointment verification; enroll only from a short-lived restricted setup session; prove possession of enrolled factor before privileges become active | **PENDING verifying office and invitation channel** |
| MFA-04 | Recovery | Single-use recovery codes issued during enrollment, stored only hashed; lost-factor reset requires an independently authenticated, dual-person approval and a logged, out-of-band confirmation | **PENDING recovery authorities, hours, escalations** |
| MFA-05 | Locked-out or departing staff | Suspend privileged access pending verification, revoke active sessions when factors are reset, staff role changes, appointment ends or abuse is suspected | **PENDING campus HR/IT reconciliation cycle** |
| MFA-06 | Challenge cadence | Require MFA for privileged login and after authentication-state changes; choose an explicit reauthentication interval for particularly sensitive decisions | **PENDING exact step-up interval and exemptions** |
| MFA-07 | Abuse controls | Bound failed factor attempts and recovery attempts by account and source, include cooldown, rate-limit enrollment, and avoid account-existence disclosure | **PENDING thresholds / support procedure** |
| MFA-08 | Security and privacy | Encrypt protected TOTP secrets at rest using managed keys (if TOTP approved); hash recovery codes; avoid storing passkey private keys, raw codes or OTP values in audit logs; provide privacy notice | **PENDING storage/key ownership and DPO check** |
| MFA-09 | Accessibility | Provide a non-SMS alternative, compatible keyboard/screen reader enrollment, and recovery usable without a personal smartphone where approved | **PENDING staff usability review** |
| MFA-10 | Emergency access | Document tightly time-bounded break-glass accounts, physical custody, dual authorization, alerting and post-event review; prohibit undocumented bypass routes | **PENDING whether permitted and approvers** |

## Implementation is gated until signatures are complete
1. Produce approved factor requirements, final privilege scope, enrollment authority and staff eligibility proof. Implement restricted initial enrollment; never bootstrap a new privileged session using a student-only flow.
2. Model factor credentials and recovery state in an **additive, separately approved migration**; restrict access; ensure no client-only MFA enforcement and no privilege bypass through refresh tokens, API calls or legacy sessions.
3. Fail closed for staff privileges when no enrolled factor is verified, factor is reset, role changes or session assurance expires. Require server-side assurance for **every** staff mutation and sensitive read, not only the dashboard.
4. Provide safe recovery and revocation, replay-resistant challenges, expiration, audit metadata without codes/secrets, warnings on factor change and operations support.
5. Preserve accessibility and reasonable recovery options; do not activate for real staff without documented onboarding and recovery support.

## Mandatory synthetic acceptance matrix
- Correct password without second factor: no privileged API access; MFA enrollment-only state if separately approved.
- Factor enrollment: requires authorized staff invitation and independent proof; no other user can enroll on the account.
- Valid MFA challenge: staff session assurance established and bound to session/role; ordinary students cannot self-upgrade.
- Replayed, expired, malformed, brute-force or cross-session factor challenge: denied and rate-limited.
- Refresh, alternate endpoints, direct API calls, suspended account, revoked role and stale sessions: cannot bypass MFA.
- Recovery code: single use; concurrent redemption has at most one success; recovery revokes prior sessions and factor assurances.
- TOTP clock drift/WebAuthn origin and rpId checks when respective factor selected; phishing-resistant option preferred.
- New device and supported assistive technologies: enrollment, challenge, recovery and session expiration tested.
- Audit: records actor, source, event and outcome but no password, OTP, secret, private key or recovery code.
- Isolated MySQL integration, HTTP authorization, browser/physical device UAT, rollback rehearsal and owner sign-off all documented.

## Authorization record
**Decision:** [ ] APPROVED AS WRITTEN [ ] APPROVED WITH ATTACHED CHANGES [ ] RETURNED FOR REVISION [x] NOT YET APPROVED

Institutional owner signature/date: ____________________
Information security sign-off/date: ____________________
DPO/privacy review/date: ____________________
Implementation change request and test evidence: **NOT CREATED**
**Gate status:** BLOCKED. Existing password-only staff sessions are not sufficient for production release.

**Source baseline:** MASTER_BLUEPRINT.md Module 01; docs/SECURITY_ASSESSMENT_BATCH_2026-11-17.md; docs/RELEASE_SECURITY_GATES_DECISION_RECORD_2026-11-17.md.
