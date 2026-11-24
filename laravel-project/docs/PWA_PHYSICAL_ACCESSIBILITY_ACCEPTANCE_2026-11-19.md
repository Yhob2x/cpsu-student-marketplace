# CPSU Market — physical-device and assistive-technology acceptance
**Audit date:** 19 November 2026
**Scope:** Responsive website/PWA for student, seller, and university administrator. Old Expo code is archived.
**Safety:** No live purchases, sensitive IDs, student information, database edits, or notification-permission changes by this audit.

## Verification already completed (desktop browser emulation)
- Microsoft Edge/Chromium, 360/768/1280px: 12 public route-width snapshots; no document horizontal scroll.
- Synthetic API fixtures (no real sign-in or server data): 27 student/admin route-width combinations; no JavaScript errors, no document horizontal overflow, no undersized touch controls, no detected WCAG A/AA axe violations in the empty-state fixtures.
- Browser keyboard traversal: Skip to main content; branded home; search input and submit; installation help; sign-in; filters; sort; footer; chat.
- PWA manifest loaded in Chromium and service worker active; cached paths limited to offline.html and public icons, not API data/private pages.
- Chromium offline reload of /guidelines displayed the designed **You're offline** page, with an accessible retry link.
- `bun run pwa:check` validates icon dimensions, manifest and offline-only SW contract.
These are *not* proof of real iOS Safari, Android Chrome, TalkBack, VoiceOver or Windows Narrator acceptance.

## Device acceptance matrix (all physical-device results pending)
| ID | Device/assistive tech | Action | Expected | Result |
|---|---|---|---|---|
| D01 | Android Chrome, narrow phone (360px) | Open Home, Explore, Guidelines, Login | No clipping/side scroll; readable type, tappable controls | NOT VERIFIED |
| D02 | Android Chrome | Add to Home Screen / install PWA | Installed icon launches standalone correctly | NOT VERIFIED |
| D03 | Android installed PWA | Turn Wi-Fi/data off and open Guidelines from app | Offline page, no stale private dashboard | NOT VERIFIED |
| D04 | Android Chrome/TalkBack | Read Home, filters, sort, a listing, forms | Accessible names match visible text; correct focus/reading order | NOT VERIFIED |
| D05 | iPhone Safari (narrow phone) | Open 4 public pages at normal/large text | Content wraps, no zoom-on-focus, no clipped bottom nav | NOT VERIFIED |
| D06 | iPhone Safari | Share → Add to Home Screen | Installed icon works in standalone mode | NOT VERIFIED |
| D07 | iPhone installed PWA | Turn Wi-Fi/data off and open a page | Descriptive offline fallback; no private cache | NOT VERIFIED |
| D08 | iOS VoiceOver | Explore/filter, listing, saved, chat controls | Accurate labels/states, discernible focus and actions | NOT VERIFIED |
| D09 | Windows Narrator or NVDA, keyboard only | Tab/Shift+Tab through public + role-authenticated screens; Escape dialogs | Visible focus, skip link, sensible order, usable dialog escape | NOT VERIFIED |
| D10 | Real logged-in student/seller/admin | Trigger loading, error, empty, success states | Announced status, clear recovery, no UI jump or exposed data | NOT VERIFIED |
| D11 | Real phone with poor network | Slow 3G/low power; open images, messages and filters | No overlapping controls, meaningful loading/error states | NOT VERIFIED |
| D12 | Real phone with PWA push permission on HTTPS | Receive one genuine message/transaction notice | Correct privacy-preserving notification and unread counts | NOT VERIFIED |

## Practical test instructions
Use an authorized test account on the real HTTPS deployment (localhost on a phone generally does not qualify for PWA push installation features). Do not enter personal student ID images. For each case, record device model, OS/browser, viewport if known, date, initial state, steps, outcome, screenshot or short recording, and defect ticket. Capture personal information only when redacted. If an issue is found, document the smallest reproducible path and retest the same device after a fix.

**Android TalkBack:** Settings → Accessibility → TalkBack. Navigate by swiping and activate by double tapping; inspect buttons with icon-only labels, dynamic notification counts, headings, seller links, form validation, sorting radio groups and dialog controls. Turn TalkBack off after testing.

**iPhone VoiceOver:** Settings → Accessibility → VoiceOver. Navigate through headings, buttons, form controls, and interactive images; activate with double tap. Test Safari and installed PWA separately; iOS web notifications vary by installation state and permission.

**Keyboard/Narrator:** Enable Narrator in Windows Accessibility settings, or an approved NVDA installation. Test Skip link, heading structure, form focus, Escape-to-close, first/last focus movement, alerts, and Enter/Space activation. The presence of Narrator.exe on Windows was checked; Narrator was *not operated* by this audit.

## Release gate
Keep **physical-device accessibility acceptance: NOT VERIFIED** until every applicable row is executed on an actual device and evidence is reviewed. Automated axe = 0 violations and a passing build do not meet this release gate.
