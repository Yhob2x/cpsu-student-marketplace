# Managed Homepage Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let global university administrators edit and publish the homepage's designed text and selected images without changing marketplace data or student workflows.

**Architecture:** One additive `HomePageContent` row stores a validated draft and its last published snapshot. Admin edits and image uploads are authorized, revision-checked, audited, and explicit publication copies the draft to the public snapshot. Three image slots (hero, guidance artwork, seller-banner artwork) use the existing sanitization and configured private storage adapter; public image serving checks the published snapshot, and draft image serving requires global admin access. Missing schema/publication falls back to the existing homepage.

**Tech Stack:** Express 5, Prisma/MySQL, Zod, Sharp, existing media adapter, React/Vite.

**Spec:** The owner's 18 November 2026 request to make the redesigned homepage's text and images editable in Admin Content, with the existing `MASTER_BLUEPRINT.md` moderation and audit requirements.

## Global Constraints

- Only `university_admin` with global scope may edit or publish; campus reviewers and students cannot.
- Product listings, categories, followers, prices, and seller photos continue to come from their existing APIs.
- The public homepage reads only published content; defaults remain when no content or schema exists.
- Images are decoded, re-encoded, size-limited, stored through the configured adapter, and served only with the applicable public/admin authorization.
- No live database migration, deployment, commit, or push is included in source implementation.

## Review Focus

- A stale editor must receive a conflict instead of replacing another administrator's draft.
- A draft image must not be exposed through a public URL before publication.
- A failed upload or publish must leave the last published page intact.
- Missing new schema must preserve the existing public homepage.
- Existing marketplace search, listing, save, message, install, and footer actions must stay wired.

---

### Task 1: Content contract and storage

**Files:** Create `apps/api/src/home-page-content.ts`, additive Prisma model and migration; test `apps/api/test/home-page-content.test.ts`.

- [ ] Write failing schema/default/validation tests and observe the missing implementation failure.
- [ ] Define the editable copy fields and image slots, with strict plain-text validation and safe defaults.
- [ ] Add the single-row draft/published model and additive migration.
- [ ] Run focused unit and Prisma validation checks.

### Task 2: Authorized API and images

**Files:** Modify `apps/api/src/routes/admin.ts`, `apps/api/src/routes/public.ts`; test `apps/api/test/home-page-content-http.test.ts` or isolated integration coverage.

- [ ] Write failing tests for global-admin-only edits, stale publish, draft image privacy, and public fallback.
- [ ] Add admin read/save/publish/upload/draft-image routes with audit and revision guards.
- [ ] Add public content and published-image routes; fail closed for missing/unpublished images.
- [ ] Run focused API and type checks.

### Task 3: Admin editor and homepage rendering

**Files:** Modify `apps/web/src/pages-managed-content.tsx`, `apps/web/src/pages-public.tsx`, `apps/web/src/editorial-redesign.css`; test a focused web content/rendering test.

- [ ] Write failing tests for editable draft/published rendering and unchanged listing data.
- [ ] Add labeled admin fields, three image pickers/previews, save/publish states, and error feedback inside Content.
- [ ] Read published content on Home and apply it to static copy and the three image slots only.
- [ ] Run web tests, TypeScript/Vite build, and responsive browser checks.

### Task 4: Verification and documentation

**Files:** Update `docs/EDITORIAL_UI_REDESIGN_2026-11-18.md` and relevant progress record.

- [ ] Run API/web tests, type checks, production web build, and `git diff --check`.
- [ ] Verify the additive migration against an isolated database if available; do not activate live development or production databases.
- [ ] Run `graphify update .` and report any environment or activation gates.
