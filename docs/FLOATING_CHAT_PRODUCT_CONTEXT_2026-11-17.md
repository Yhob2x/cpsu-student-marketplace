# CPSU Market — Listing product card in floating messages

Date: 2026-11-17

## User request
Show the product being discussed inside the existing lower-right floating message window, not only in the full-page conversation.

## Change
- Add a compact, persistent listing card directly above the floating chat's message log. It shows the real listing's photo (or fallback), title, price and price basis, condition, availability and a View listing link.
- This works for product and service conversations. When a listing becomes unavailable, the authorized thread still shows its context, but has no public listing link; hidden/unpublished media is never loaded.
- Keep the card outside the scrollable message log so reviewing older messages does not lose product context. Limit the card's height on narrow screens so the log and composer remain usable.
- Extract the existing full-page conversation card into one shared component so both chat surfaces use the same listing presentation and availability rules.
- Reuse the participant-only GET /inquiries/:id/messages response; no additional API requests, database writes, schema changes, or authentication changes.
- Preserve existing floating inbox, message polling, incoming sound, unread acknowledgments, sending, keyboard fit and reduced-motion behavior.

## Files
- Created apps/web/src/conversation-listing-card.tsx
- Modified apps/web/src/pages-account.tsx (reuse shared listing card)
- Modified apps/web/src/floating-chat-panel.tsx (pinned compact card)
- Modified apps/web/src/floating-chat.css (compact styling)
- Created apps/web/test/conversation-listing-card.test.tsx

## Verification
- bun test test/conversation-listing-card.test.tsx test/floating-chat.test.tsx test/storefront-chat.test.tsx — **9 pass, 0 fail**.
- Full `cd apps/web && bun test` — **69 pass, 0 fail**, 264 assertions across 20 test files.
- bun run build (TypeScript and Vite) — **pass**.
- `git diff --check` — **pass**; Graphify index refreshed per repository rules.
- Existing React useLayoutEffect warnings from SSR-only test rendering and preexisting StorefrontView key warning remain nonfatal.
- Physical iPhone Safari / Android Chrome accessibility and keyboard overlays were **not** tested.
- No user messages, student records or listing data were changed.
- No DB migration, deployment, Git commit or push.
