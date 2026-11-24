# Package B1.2 — Real MySQL Conversation Closure Acceptance
**Date:** 2026-11-17
**Scope:** Add real HTTP/MySQL integration coverage for End conversation; correct isolated test-discovered gaps without new schema or business-policy changes.
**Authority:** MASTER_BLUEPRINT.md MODULE 06, AGENTS.md, docs/CONVERSATION_SAFETY_B1_2026-11-16.md, docs/STAGE1_TESTING_REPORT.md.
**Safety:** Reuse the guarded Stage 1 integration runner against local cpsu_marketplace_test only, with MEDIA_STORAGE=local, no Google Drive credentials, synthetic two-campus users, fixture reset before/after. Execute suites sequentially, do not bypass guards or run migrations against cpsu_marketplace.
**TDD:** First add a failing runner wiring check, then a guarded integration suite. Validate participant-only closure, idempotent audit, history retention, both message bypasses blocked, typing/presence rejected after close, and concurrent send/close outcome. Implement the smallest fix if any test exposes a bug. Keep test traffic synthetic.
**Verification:** Guarded MySQL acceptance + existing Stage1 and reporting suites, API unit/typecheck, web test/build, PWA validation, git diff --check. Document limitations, especially MySQL deadlock retry semantics and real-device QA.
