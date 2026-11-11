# CPSU STUDENT MARKETPLACE — AI CODING AGENT RULES

## 1. PROJECT IDENTITY

Project: CPSU Student Marketplace

Institution: Central Philippines State University

Application: Student-to-Student Marketplace

Platform: Responsive Web Application / PWA

Scope: MVP Version 1.0

Primary Reference: `MASTER_BLUEPRINT.md`

## 2. FIRST ACTION REQUIREMENT

Before modifying any source code, read:

- `MASTER_BLUEPRINT.md`
- Relevant documents inside `/docs`
- Relevant development records inside `/progress`

Inspect the existing source code before proposing or implementing changes.

Never assume the project is empty or that a feature is not implemented.

## 3. REQUIREMENTS COMPLIANCE

All development must comply with the approved:

- System vision.
- Functional requirements.
- Business rules.
- User roles.
- Database architecture.
- MVP scope.
- Security requirements.
- UI/UX standards.

The master blueprint is the authoritative project specification.

## 4. STRICT MVP BOUNDARIES

Only implement approved Version 1.0 functionality.

The following are explicitly excluded:

- Online payment integration.
- Digital wallets.
- Escrow.
- Delivery management.
- Commission collection.
- Subscription plans.
- External commercial vendor accounts.
- Paid advertisements.
- Auctions.
- Loyalty programs.
- AI chatbots.
- Advanced recommendation engines.

Do not implement excluded functionality unless explicitly approved by the project owner.

## 5. DEVELOPMENT PRINCIPLES

Follow these principles:

1. Inspect before modifying.
2. Understand before implementing.
3. Reuse existing components.
4. Avoid unnecessary refactoring.
5. Maintain existing functionality.
6. Follow established naming conventions.
7. Maintain database integrity.
8. Implement proper authorization.
9. Validate all user inputs.
10. Test every significant change.
11. Document implementation decisions.

## 6. SECURITY AND AUTHORIZATION

Never rely exclusively on frontend validation.

All sensitive operations must be authorized on the server.

Students must not:

- Modify another student's listings.
- Access another student's private conversations.
- Modify another student's transactions.
- Perform administrative actions.
- Bypass student verification.
- Access restricted administrative records.

Administrative operations must be restricted to authorized administrators.

## 7. DATABASE MANAGEMENT

Before modifying the database:

- Inspect the existing schema.
- Review relationships.
- Identify dependencies.
- Prepare migrations.
- Preserve existing data.
- Verify changes.

Do not introduce duplicate tables or unnecessary database structures.

## 8. FRONTEND REQUIREMENTS

Maintain:

- Responsive layouts.
- Reusable components.
- Consistent navigation.
- Accessible forms.
- Proper loading states.
- Empty states.
- Error messages.
- Success feedback.

The mobile student experience must be prioritized.

The administrator interface must be optimized for administrative workflows.

## 9. BACKEND REQUIREMENTS

All backend functionality must include:

- Proper request validation.
- Authentication checks.
- Authorization checks.
- Error handling.
- Database integrity.
- Appropriate logging.

Never expose sensitive configuration or credentials.

## 10. MULTI-AGENT SAFETY

Before editing shared files:

- Check the current implementation.
- Check existing changes.
- Identify potential conflicts.
- Avoid overwriting another agent's work.

Do not assume another agent's code is correct without reviewing it.

## 11. OUT-OF-SCOPE REQUESTS

When asked to implement an unapproved feature:

1. Identify the feature.
2. Compare it with the master blueprint.
3. Classify it as MVP, Future, or Out of Scope.
4. Explain the conflict.
5. Wait for approval when scope changes are required.

Do not silently expand the MVP.

## 12. COMPLETION REPORT

After every significant task, report:

- Task completed.
- Requirements addressed.
- Files created.
- Files modified.
- Database changes.
- Tests executed.
- Test results.
- Remaining issues.

Distinguish between implemented, tested, and verified functionality.

## FINAL RULE

The CPSU Student Marketplace must be developed according to the approved master blueprint.

Do not invent requirements.

Do not introduce unauthorized features.

Do not compromise database integrity.

Do not bypass security requirements.

Do not modify approved business rules without authorization.

The objective is a functional, secure, maintainable, and usable university marketplace — not merely a visually complete application.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
