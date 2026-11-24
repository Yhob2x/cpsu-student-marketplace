# Package B1 — Conversation End and Safety Guard Design

**Date:** 2026-11-16. **Authority:** CPSU Market `MASTER_BLUEPRINT.md` Module 06; previous Package A audit and request to continue.

## Purpose

Permit either conversation participant to end an unwanted chat without exposing private messages to staff, changing university verification policy or adding tables. This is **not** cross-listing user blocking and must not be represented as such.

## Approach

- Reuse the existing `InquiryThread.status` open/closed column and participant authorization helper.
- Add `POST /inquiries/:id/close` for participants only. Guard positive id; update only an open thread with an atomic conditional update, write a minimal actor/action audit entry if changed; make repeated closing idempotent.
- Enforce `closed` in **both** message entry paths: `POST /inquiries/:id/messages` already checks; `POST /inquiries` currently upserts without testing closed status. Fix this bypass before exposing Close.
- Add explicit in-chat confirmation, feedback and a closed-state banner. Explain that closing prevents further messages **on that listing only, for both participants**, and does not cancel outstanding transactions.
- Do not add reopening, unblock, message deletion, staff message inspection, report routing, notifications, or new policies without their own approvals.

## Safety and test boundaries

- Each endpoint checks authentication, active student role, authorization to a specific thread; strangers get 404.
- Repeating close does not create extra audit events.
- A closed conversation cannot be recreated by starting another inquiry for the same listing; messages stay readable to participants.
- No schema/migration, student data, external transport, credentials, deploy, or firewall changes in this work.
- Tests: pure closure rule, route regression assertions, TypeScript, full Bun unit tests, Vite build. Full auth/DB integration needs separately approved isolated fixtures.

## Follow-ups requiring separate CPSU decision

1. Actual `Block user` needs a scoped, durable relationship model (who blocks whom, across listings; transactional and safety exemptions; appeals and audit).
2. `Report private message or user` needs an approved evidence model and restricted reviewer access; do not falsely label an ordinary listing report as a private-message report.
3. `Password reset` needs reset token lifecycle, approved identity proof and secure delivery transport before enabling visitors.
4. Verification rules need a campus policy decision before changing who may message; currently registration permits new students to inquire but transactions require verified status.
