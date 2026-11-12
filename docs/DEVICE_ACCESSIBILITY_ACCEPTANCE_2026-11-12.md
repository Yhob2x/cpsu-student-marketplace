# CPSU Student Marketplace — Device and Accessibility Acceptance

**Date:** 12 November 2026  
**Scope:** Local Windows development environment only  
**Reference:** `MASTER_BLUEPRINT.md`; `docs/UI_UX_GUIDELINES.md`; `docs/PHASE4_REGRESSION_QA_2026-11-12.md`  
**Release gate:** **BLOCKED — physical-device and human-assisted assistive-technology sign-off outstanding.**

## 1. Tested environment and coverage

- Local Windows device `DESKTOP-P5OAG7F`, Chrome Headless via Chrome DevTools Protocol, React/Vite web and local Bun/Express API.
- Free `axe-core@4` installed in the OS temporary directory for testing; no app dependencies added.
- Automated Axe WCAG A/AA and best-practice audit: **24 route/width evaluations with zero remaining detectable violations**:
  - Public: Home, Explore, Sign in, Register, Guidelines at 390 and 1440px (10).
  - Authenticated, API-mocked, read-only: Seller dashboard, Messages, Conversation, Saved, Profile, Notifications, Reviewer admin at 390 and 1440px (14).
- Chrome's accessibility tree on Explore exposed named input/link/button/combobox controls; no unnamed controls found in the inspected tree.
- Keyboard Tab navigation at phone width tested on Home, Explore and Register: the skip-to-content link came first, focus followed visible controls, and the 3px focus outline was visible.
- Conversation log in a **read-only browser fixture** with 35 messages was focusable, named “Conversation messages”, and exposed role `log`; keyboard Page Down moved scrollTop from 0 to 203px without horizontal overflow.
- 320px viewport with 200% root text size: Home, Explore, Login and Register remained within the viewport, input text remained ≥16px, and mobile navigation labels did not clip.
- Reduced-motion emulation: `prefers-reduced-motion: reduce` was recognized and primary button transitions were 0s.
- Forced-colors emulation: controls remained visible with a forced-colors text/background contrast and a 3px keyboard focus outline.

## 2. Automated findings corrected locally

1. **Heading order:** footer navigation headings updated from level 3 to 2; Explore gained a screen-reader-only level-2 “Listing results” heading; Seller dashboard “CPSU affiliation” updated to a level-2 heading without increasing visual size.
2. **Landmark uniqueness:** desktop header search and Home hero search now have distinct search-landmark names.
3. **Chat keyboard access:** the conversation's scrollable message log gained `tabIndex={0}` so keyboard users can move focus into it and scroll independently.

**Affected code:** `apps/web/src/main.tsx`, `apps/web/src/pages-public.tsx`, `apps/web/src/pages-account.tsx`, `apps/web/src/styles.css`, `apps/web/src/storefront-theme.css`, and `apps/web/src/message-motion.css`.

All previously found Axe heading, landmark and scroll-region violations were cleared by a subsequent audit of the same route/width matrix. A later concurrent message-receipt UI update introduced generic-element ARIA labels; these were corrected to use appropriate message-group semantics and visible date/receipt text. A controlled **chat-only retest** at 390px and 1440px found 0 detectable violations, 0 unnamed inputs and no remaining ARIA-attribute inconclusive checks. Existing color tokens, save behavior, API authorization, listing data, and keyboard send behavior were preserved.

## 3. Contrast audit limitations

Axe flagged **incomplete**, not failed, contrast calculations on Home (96 nodes) and Explore (119 nodes) at the tested widths because the stretched listing-card link overlaps text in the rendering tree. The updated conversation screen also left 12 contrast calculations inconclusive on desktop. This prevents declaring every individual text element contrast-verified automatically.

Manually calculated representative color pairs from computed styles:

| Foreground / background | Ratio | Result |
|---|---:|---|
| Body ink / white | 15.25:1 | AA pass |
| Secondary text / white | 6.53:1 | AA pass |
| Filter labels / soft panel | 6.06:1 | AA pass |
| Active tab green / pale-green tab | 11.26:1 | AA pass |
| Footer link / forest green | 10.05:1 | AA pass |

**Residual:** visually inspect every listing card variant and any text over images on actual devices; do not treat representative sampling as a full contrast audit.

## 4. Physical hardware and assistive technology — NOT COMPLETED

No physical Android device or ADB/Android SDK was available on the connected Windows computer. No iPhone/macOS testing connection was available. NVDA was not installed and Narrator was not running, so actual screen-reader speech and rotor/focus announcements were **not** verified. Chrome emulation, Axe, and the accessibility tree are *not substitutes*.

The following acceptance steps must be executed on real devices before production approval:

- [ ] iPhone Safari: notch/home-indicator safe areas, 320/390px layout, 200% text, search/filter inputs without unwanted zoom, tab bar and save heart targets, browser back, chat with keyboard open/close, no obscured composer.
- [ ] iPhone VoiceOver: header/primary navigation landmarks, skip link, card links vs save buttons, labels and errors, Home/Explore filters, messaging log reading and focus, moderation if used on iPhone.
- [ ] Android Chrome: touch and long-press behavior, soft keyboard, page scrolling, sticky hover absence, safe-area handling, 200% text, one-handed tab bar.
- [ ] Android TalkBack: navigate all interactive controls by swipe, labels/states, card hearts, filter error/retry announcements, conversation history and send controls.
- [ ] Windows NVDA or Narrator: keyboard-only buyer/seller/reviewer workflows and speech output, especially the named conversation log and success/error announcements.
- [ ] Expo native app on a real Android/iOS device if native release is included; a TypeScript pass does not verify native behavior.
- [ ] Use nonproduction accounts/test data to carry a complete buyer → seller → reviewer workflow through the UI (save/un-save, inquiries, seller listing review, moderation decisions, rejection/retry, closed threads).

**Exit criteria:** No critical/high accessibility, interaction, or data-integrity issue remains; screenshots and outcomes are recorded by a human tester on real devices; project owner approves the release. Remain local until that approval.

## 5. Reproducibility and integrity

- Build/test commands: `cd apps/web && bun run build`, `cd apps/mobile && bun run typecheck`, `bun run test`, and from `apps/api`: `bun run test:integration` (dedicated `cpsu_marketplace_test` schema only).
- Final regression results: web TypeScript/Vite build passed; native TypeScript passed; API unit tests 5 passed and 1 opt-in suite skipped by default; the separately executed **isolated integration suite passed 18/18 tests with 112 assertions**, including the new message-receipt test, and its integrity audit found 0 orphan rows. An earlier integration attempt failed during concurrent receipt-test editing; the updated isolated-fixture test passed on rerun. No unrelated messaging code was changed during this accessibility task.
- Separate browser test fixtures intercepted API calls; they did **not** create real user accounts, modify listings, save favorites, send messages, or change moderation data.
- No push, commit, deployment, production migration, or credential change was performed.
- Existing unrelated local worktree changes must not be reset.

**Conclusion:** Automated accessibility and desktop-browser simulated acceptance checks PASS. **Full device/accessibility acceptance is still BLOCKED until actual iPhone/Android and screen-reader verification.**
