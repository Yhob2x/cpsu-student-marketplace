# Reviewer Account Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give reviewers staff-only accounts that administrators can manage separately from students.

**Architecture:** Reuse User and UserRole. Add a campus-reviewer management API and Staff UI; enforce student-only capabilities in server middleware. Preserve historical data.

**Tech Stack:** Express, Prisma, React, TypeScript, Zod.

**Spec:** `docs/superpowers/specs/2026-11-16-reviewer-account-separation.md`

## Global Constraints

- Only global `university_admin` accounts manage reviewers.
- Campus reviewers cannot gain university or system administrator roles through this workflow.
- No schema migration or automated edits to existing affiliations/history.
- Staff accounts are excluded from student account searches and student actions.

## Review Focus

- Duplicate email on create or update returns conflict without changing an account.
- Changing reviewer campus or password revokes existing sessions.
- A suspended reviewer loses access immediately; reactivation requires login.
- Existing staff accounts with student affiliations remain protected from student actions.
- Campus reviewers cannot call the staff management API.

---

### Task 1: Server role boundary and staff API

**Files:** `apps/api/src/auth.ts`, `apps/api/src/routes/{seller,account,inquiries,admin}.ts`, `apps/api/src/routes/reviewers.ts`, `apps/api/src/app.ts`, `apps/api/test/staff-boundary.test.ts`.

- [x] Write tests for staff/student role classification and run them red.
- [x] Add student-only middleware to student action routes; keep profile and notifications available to staff.
- [x] Add global-admin-only reviewer list/create/edit endpoints with validation, audit, session revocation and duplicate-email handling.
- [x] Run tests and API typecheck.

### Task 2: Staff and student administration UI

**Files:** `apps/web/src/pages-admin.tsx`, `apps/web/src/pages-reviewers.tsx`, `apps/web/src/main.tsx`, `apps/api/prisma/seed.ts`, `docs/{API_DOCUMENTATION,USER_ROLES_PERMISSIONS}.md`.

- [x] Add dedicated Staff section with create and edit forms, loading/error/success states.
- [x] Hide student-only navigation and actions for staff accounts.
- [x] Exclude staff from Student accounts API and update development seed for new staff accounts.
- [x] Run web typecheck/build and regression tests.
- [ ] Refresh graphify; its configured Python executable currently returns access denied.
