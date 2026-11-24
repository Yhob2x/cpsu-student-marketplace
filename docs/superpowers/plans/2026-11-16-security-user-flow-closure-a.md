# Security and User-Flow Closure — Package A Implementation Plan

> **For agentic workers:** Follow Superpowers TDD and verification-before-completion. Work against the current dirty worktree without resetting, stashing, committing, migrating or deploying.

**Goal:** Close four independent high-friction or safety-related student journeys without changing university verification policy or database structures.

**Architecture:** Keep existing React Router / useMe session context and existing `/reports` server endpoint. Add narrow presentation/state changes only. Avoid changing server eligibility policy, auth/session protocols, storage, or database data.

**Tech Stack:** React, TypeScript, React Router, Bun tests, Vite, Express API (unchanged).

## Approved scope (from owner's "go for your recommendation")

- [x] Sign-in and register forms show busy state and prevent repeated submissions.
- [x] Saved page sends signed-out users to sign-in after session restoration instead of showing endless loading.
- [x] Logout errors keep the user informed and never pretend that revocation succeeded.
- [x] Store page lets signed-in students (not staff or the store's owner) report a seller using the existing validated `/reports` API.
- [x] Test affected logic/components, run web/API typechecks and available tests.
- [x] Document remaining blockers and exact changed files.

## Guardrails

- Preserve all existing uncommitted changes; no source-wide formatting or refactor.
- Never create real users, seed a development DB, migrate schemas, modify firewall/network, configure email, or deploy.
- Do not change student verification eligibility, introduce message blocking, promise automatic content moderation, or gather additional student PII without institution-approved design.
- Use progress/error messages as actual state, not false success.
- If automated browser acceptance cannot be obtained, record that explicitly.

## Release-gated follow-ups (not authorized by this package)

Password-reset transport/identity verification; cross-campus eligibility policy; user/conversation blocking schema; admin investigation workflow; migrations; production HTTPS; security appliance/firewall configuration; real-phone accessibility testing.
