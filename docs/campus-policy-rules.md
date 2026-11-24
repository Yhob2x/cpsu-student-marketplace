# Campus policy rules (PLACEHOLDER: CPSU must approve before launch)

The seed script creates a version-1 policy per campus marked "PLACEHOLDER - pending CPSU approval" and puts **Food & drinks** under manual review.
Replace this with the officially approved rules. See section 16 of `architecture.md` for the decisions CPSU must confirm.

How the rules engine behaves today (`apps/api/src/rules.ts`): it only **flags** (sensitive category, campus restriction, possible overlap with
establishments by keyword, academic-integrity keywords, missing photos, bad price). A human reviewer decides, with a written reason, and the decision
stores the policy version. Keyword lists are starting points, not policy.
