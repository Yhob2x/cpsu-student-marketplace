# CPSU Market — Floating Chat Window

Date: November 17, 2026 | Approved scope: floating messaging window in the lower-right, following the Chat launcher screenshot.

## Design and behavior
- Clicking the existing warm-gold lower-right Chat button now opens a **non-modal floating messaging window**, without leaving the current public/student page.
- The popup has an inbox (student name, listing context and message preview), a thread view (existing server messages and reply composer), back and close controls, and links to open the full messaging route.
- It reuses the current authenticated endpoints: GET /inquiries, GET /inquiries/:id/messages, POST /inquiries/:id/messages, POST /inquiries/:id/typing, POST /inquiries/:id/seen. The existing full-page inbox/conversation remain the complete source for advanced controls, including ending conversations, receipts and handoff details.
- Existing authenticated student requirements and backend authorization remain unchanged. No new chat AI, paid service, persistence tables or frontend auth bypass was introduced.
- Messages are loaded only while the popup is open. Inbox refreshes every 5 seconds; an active thread refreshes every 3 seconds when the browser tab is visible. Initial history does not cause a receive sound. Outgoing messages stay silent. Only new incoming messages can play the existing receive-sound logic.
- Read acknowledgments are limited to incoming messages at least half visible within the popup log. Unread badge uses the existing Shell count and refreshes after successful acknowledgments.
- The popover stays above the Chat launcher and mobile bottom tabs. On-screen-keyboard accommodation uses visualViewport; the panel only changes to the visible-height layout when a real keyboard offset is detected. Hardware keyboard focus alone does not make the panel full-screen.
- Close via ×, Escape or outside click. The close button and Escape restore launcher focus. Opening/switching conversations focuses the heading. The popup is non-modal; background remains accessible. Reduced-motion preference disables entrance and launcher animations.
- The floating launcher/panel do not appear on /inquiries, /inquiries/:id, login, registration or staff workspace pages. Guest launcher still uses the safe sign-in route with next=/inquiries.

## Files
- apps/web/src/floating-chat.tsx — launcher and popup lifecycle
- apps/web/src/floating-chat-panel.tsx — lightweight inbox/thread presentation using current API
- apps/web/src/floating-chat.css — fixed popup, list, bubbles, composer, keyboard and safe-area styles
- apps/web/src/main.tsx — passes shared unread-count refresh callback
- Existing apps/web/test/floating-chat.test.tsx and auth-return tests remain in use.

## Verification
- Bun + TypeScript + Vite build: PASS.
- Focused Bun tests (floating Chat, auth return, footer, Profile): 18 passed, 0 failed.
- Playwright synthetic-session checks at 320×568, 390×844, 768×900 and 1280×850: popup opens, remains within viewport without horizontal document overflow, and stays above launcher and tabbar after 160ms entrance transition.
- Playwright synthetic conversation: inbox loaded, thread opened, exactly one POST /inquiries/71/messages was intercepted in the browser, new outgoing message appeared in the message log, composer cleared, returned to inbox, and Escape closed the popup. No real student message or database write occurred.
- On 390px mobile, focusing the composer without an on-screen keyboard retained the floating popup layout; trigger was hidden while composing to avoid covering the field. Screenshot inspected.
- The old Chat trigger, guest sign-in flow and staff exclusion were covered by focused unit tests.

## Remaining release gate
Physical iPhone Safari and Android keyboard-overlay/pinch/VoiceOver testing is still required. Browser emulation is not hardware certification. No commit, push, deployment or schema migration was performed.
