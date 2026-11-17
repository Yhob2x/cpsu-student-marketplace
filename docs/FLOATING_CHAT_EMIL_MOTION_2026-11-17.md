# CPSU Market — Emil Kowalski Motion Refinement (17 Nov 2026)

## Scope

User requested Emil Kowalski-style open/close and conversation-opening motion for the existing floating chat window. Changes are **presentation-only** on the CPSU Student Marketplace web frontend. Use the approved forest / ivory / selective gold palette. Preserve the existing inquiry, message and authorization APIs, mobile keyboard behavior, unread counts and guest login return.

The installed local `.agents/skills/emil-design-eng/SKILL.md` was reviewed. Decision framework: animation should clarify spatial continuity, stay under 300ms for UI, use a decisive custom ease-out, avoid animating frequently repeated keyboard actions, respect reduced-motion settings, avoid scale(0), animate only opacity and transforms where possible.

## Before / after

| Before | After | Reason |
| --- | --- | --- |
| CSS 160ms mount-only keyframe; close unmounted immediately | Reversible `opacity` / `transform` entrance (180ms) and exit (125ms) | Spatial continuity from the lower-right Chat trigger, consistent exit, no timer-dependent unmount |
| Reopening during close restarted the entrance | Interrupted exit reverses the same CSS transition | Avoids restarting a jumpy keyframe; keeps state alive |
| Inbox / conversation change was abrupt | 140ms directional, small-distance fade + slide: right to open thread, left to return to inbox | Establishes forward/backward spatial orientation |
| No keyboard-specific animation decision | Enter/Space, Escape, and `prefers-reduced-motion: reduce` open/close without transitional delay; keyboard-activated inbox items skip view motion | Frequent keyboard actions remain immediate and accessible |
| No explicit phase state | `closed/entering/open/exiting` lifecycle, with removal on `opacity` transition end | Allows actual exit animation without artificial setTimeout |

The initial window appearance does not also animate inbox content (avoids doubled motion). Transitions use `cubic-bezier(.23,1,.32,1)`, start from `translateY(8px) scale(.975)`, and honor reduced-motion media preference. Closing is `aria-hidden` and non-interactive until unmounted, and button focus is restored on Escape/close. Leaving the route immediately unmounts the popup.

## Files

- `apps/web/src/floating-chat.tsx`: exit-aware lifecycle, reversible transitions and keyboard/reduced-motion handling.
- `apps/web/src/floating-chat-panel.tsx`: phase presentation, transition-end cleanup, view-direction handling, accessible focus and keyboard close behavior.
- `apps/web/src/floating-chat.css`: contained performant motion and media-query fallbacks.
- No API, database, package manifests, migrations, or production configuration changed.

## Verification

- `cd apps/web; bun run build`: TypeScript/Vite PASS.
- Focused Bun regression suite: 18 passed, 0 failed.
- Playwright in a **synthetic authenticated browser session** at 390×844 confirmed: pointer open initially partially transparent and shifted, fully opaque after 225ms; pointer close retains exiting phase for the transition and then unmounts; opening a thread has only the new view/heading animation; rapid close→reopen retains the popup; Escape closes instantly and restores focus; reduce-motion has `0s` transition and closes immediately; Enter opens without animation; keyboard close and outside-click closure succeed. No document-wide horizontal overflow.
- The test API responses were intercepted locally; no real student records, messages, or credentials were read or written.
- Existing browser layout checks for chat at 320, 390, 768 and 1280 CSS pixels passed during the earlier floating-chat development.
- Physical iPhone Safari and Android on-screen keyboard / VoiceOver / TalkBack remain separate acceptance gates.

## Change control

No commit, push, deployment, DB migration, or student-data change was performed. Other local uncommitted work was preserved.
