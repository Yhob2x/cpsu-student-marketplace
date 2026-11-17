# CPSU Market — Sitewide Footer UI/UX Refinement

Date: November 17, 2026 | Requested: fix footer UX/UI, especially following Profile student-side audit.

## Scope and implementation
- Existing forest-green background, warm gold small highlights, ivory/white type and CPSU product identity preserved.
- Extracted the footer into `apps/web/src/site-footer.tsx`, called from `apps/web/src/main.tsx` with an account-audience value and a reviewer-capability flag. Existing Shell session/auth code remains authoritative.
- Desktop: a tidy grid with recognizable CPSU logo/description, Browse links, account-aware links and factual Help & safety guidance. Link destinations are only existing routes. Removed the duplicate link to Guidelines originally presented as a separate report page.
- Student account: links to My listings, Saved items, Transactions and Notifications; never shows Sign in or Create account. Guest: only Sign in/Create account as account destinations. Reviewer/staff: reviewer workspace if authorized plus Notifications and Profile; no student buying/selling actions. During session restoration, account links do not flash as guest.
- Mobile and tablet <=860px (the fixed-tabbar breakpoint): a compact footer instead of a long four-column list. Retains brand, short transparency message, three relevant utility links (role-aware) and a small copyright/meta row. Respects safe-area inset; final text remains above the fixed tab bar.
- Disclaimer wording accurately says listings are reviewed and students arrange payment and handoff themselves. Signed-in students can report from a listing detail; a separate reporting route is not invented.
- Accessible footer/nav labels, 44px minimum link hit areas, keyboard focus, and reduced-motion handling in the new `apps/web/src/footer-refinements.css`. No new deps, network calls or services.
- The Conversation page retains its existing mobile footer-hiding rule (composer and chat history remain priority).

## Verification
- 6 dedicated `apps/web/test/site-footer.test.tsx` cases for guest, student, reviewer, staff and session restoration — PASS. Existing 7 Profile presentation tests also PASS.
- `cd apps/web; bun run build` — PASS (TypeScript and Vite bundle), after footer changes.
- Installed Impeccable `detect --json` and `detect --json --scope layout` on SiteFooter: no findings reported.
- Chrome device-emulated acceptance on a synthetic/static route with intercepted synthetic session responses: 6/6 audience/viewport combinations PASS, 320, 390, 768, 1280 CSS pixels. Footer exists; account links respect roles; document has no horizontal overflow; on mobile footer base is unobscured above fixed tab bar. Mobile captures for guest, student and staff and desktop student capture reviewed.
- A route used for synthetic layout testing intentionally shows Not Found; the footer is rendered at Shell level on actual routes as well.
- React Router's MemoryRouter/Link emits standard `useLayoutEffect` SSR warnings in the *server-rendering-only test harness*; tests pass and the actual app is client-rendered. This is not a browser hydration defect.
- Physical iPhone Safari, VoiceOver and Android Chrome acceptance still required prior to launch.

## Change-control notes
- No student data, API permissions, MySQL schema, Google Drive media, deployment, commit or push were touched.
- Existing unrelated uncommitted files remain preserved. Only footer component, CSS, Shell footer import/call, focused tests and documentation were changed in scope.
