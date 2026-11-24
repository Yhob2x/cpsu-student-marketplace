# CPSU Market — Decision Gate B2: User Blocking and Private-Message Reporting
**Date:** 2026-11-17
**Status:** **PROPOSAL ONLY — requires CPSU product/security and DPO/privacy approvals.**
**Reference:** `MASTER_BLUEPRINT.md` Module 06 / Module 10, `docs/superpowers/plans/2026-11-16-account-recovery-blocking-reporting-b2-design.md`, current user/role/campus schema.

## B2-B — Durable student blocking: proposed product policy
| Decision needed | Recommended default (not approved) |
|---|---|
| What blocking does | Blocker chooses another student; **both directions of new contact are prevented across all listings**, not only one thread |
| Visibility to blocked user | No direct notification that reveals who blocked them; use a generic `contact_unavailable` response consistent with other unavailable contacts |
| Existing conversations | Preserve history as read-only evidence; deny new inquiry/reply/typing/presence for the pair |
| Transactions already accepted | **Do not silently cancel or hide** existing obligations/transaction history; campus-admin mediated dispute workflow required before modifying status rules |
| Unblock | Explicit blocker-only action, audited; original closed conversations remain closed; no silent reopening |
| Re-registration and identity | Do not use fuzzy identity matching or disclose identifiers; university-approved suspension and re-registration policy needed |
| Data and audit | Unique indexed `UserBlock(blockerUserId, blockedUserId)`, inverse index, timestamps, no self-block and no spoofed actor ID; retain minimal audit metadata |
| Anti-abuse | Bounded user/IP rate limiting and audit, idempotency, race checks, no private blocked-user discovery endpoint |

**Server enforcement required:** `POST /inquiries` (new or reused), `POST /inquiries/:id/messages`, notification dispatch, typing and presence endpoints, and any marketplace alternate contact paths. Frontend button alone is insufficient.

## B2-C — Private message/user reports: proposed privacy-minimized workflow
| Decision needed | Recommended default (not approved) |
|---|---|
| Report target | One explicit, typed target: user, conversation or **specific message**. Validate reporter is a participant and reported message belongs to that thread and is by the other participant |
| Report submission | Clear reason and optional selection of the specific message; avoid uploading ID documents or broad personal screenshots in v1 |
| What staff can see | **Not the full inbox.** Default disclose only reporter-submitted reason and the specific approved message excerpt/metadata; expanding access requires separate authorization and audit |
| Reviewer scope | Derive campus from listing associated with the conversation; unauthorized cross-campus reviewer gets 404 |
| Evidence integrity | DPO-approved immutable limited snapshot or message reference, access logs, least-privilege viewing, audit of each sensitive evidence read |
| Retention and deletion | **No fixed period selected yet**: DPO must approve exact retention, legal hold/appeal window, and deletion schedule before collection |
| Resolution | Human review with reason, actor and timestamp; dismissal, resolution, referral/appeal; no automatic sanctions or silent deletion of conversation history |
| Reporter consent/transparency | Explain precisely which selected content will be shared with moderators; do not reveal unrelated chat messages or attachments |
| Urgent risk | University-approved escalation to authorized staff; not automatic unrestricted chat surveillance |
| Anti-abuse | Actor-scoped rate limits, duplicate-report treatment, report targeting verification, no reporter-ID spoofing, reviewer status audit |

**Schema approach after approval:** additive `UserBlock` and typed report relations / minimized evidence table with indexes and constraints; explicit role/campus policies, no broad staff inbox access. Review migrations, retention processing, backups/restore drill and rollback strategy before applying anywhere.

## Cross-cutting policy decisions requiring signoff
- **Messaging eligibility:** Current active registered student accounts can message before campus verification. Choose verified-only for all messages (recommended for an institution-only deployment) **or** explicitly approve the current exception with abuse controls. This is a real business-policy change.
- **Existing transaction dispute resolution:** Decide which accepted transaction actions remain available after a block, and how campus review handles safety issues.
- **PII and evidence retention:** DPO must specify legal basis, period, appeal notice/consent expectations, deletion and emergency escalation.
- **Password recovery:** Remains separately blocked until secure student-account ownership verification and a private recovery delivery channel are approved.

## Approval checklist (all open)
- [ ] CPSU product owner approves blocking semantics, transaction handling, unblock behavior and messaging affiliation policy
- [ ] CPSU security authority approves authentication, abuse limits, actor verification and incident workflow
- [ ] CPSU DPO/privacy authority approves private-message evidence scope, retention, cross-campus access, appeals and consent/notice
- [ ] DBA/project owner approves additive migration plan, test-only fixtures, verified backup/restore, and production deployment gates
- [ ] Isolated MySQL authorization tests, IDOR/role/campus tests, race tests, web accessibility and physical iPhone QA pass

**Implementation status:** No `UserBlock` schema/migration, private report endpoint, account recovery, extra staff inbox access or production change has been activated by this memo. This document is a decision aid, not an authorization record.
