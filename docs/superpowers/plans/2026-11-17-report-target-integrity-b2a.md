# Package B2a — Report Target Integrity Plan
**Date:** 2026-11-17
**Goal:** Enforce trustworthy, campus-routable public listing and seller reports before adding privacy-gated private conversation reports.
**Reference:** MASTER_BLUEPRINT.md Module 10, AGENTS.md, docs/superpowers/plans/2026-11-16-account-recovery-blocking-reporting-b2-design.md.
**Implementation:** Introduce an isolated validated report target module. Exactly one positive target ID, 10–1000-character reason, and strict payload. Resolve only visible listings or approved, active seller profiles; disallow reporting own listing/store, preserve legitimate student reporting. Use an audited atomic insert. Reuse existing Report model and reportScope, no schema migration.
**Files:** apps/api/src/report-safety.ts (new); apps/api/src/routes/account.ts (target validation and atomic audit); apps/api/test/report-safety.test.ts (new); docs/SECURITY_REPORT_TARGET_B2A_2026-11-17.md; docs/API_DOCUMENTATION.md and docs/BUSINESS_RULES.md; progress/DEVELOPMENT_LOG.md.
**Tests:** Red-green unit tests for exactly one target, invalid/unknown/restricted/own target, async lookups, error behavior and audit atomicity contract. Fresh API tests/typecheck, web tests/build, diff check.
**Non-goals:** Do not store private conversations, grant staff message access, add email/reset links, deploy, migrate schemas, change credentials or private data. Full end-to-end DB and phone testing remain separately gated.
