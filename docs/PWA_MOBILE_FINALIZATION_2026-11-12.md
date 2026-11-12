# PWA Mobile Finalization — CPSU Student Marketplace

**Date:** 12 November 2026  
**Scope:** Local Windows repo only; one responsive React/Vite web application.  
**Reference:** `MASTER_BLUEPRINT.md`, `docs/UNIFIED_WEB_PWA_2026-11-12.md`, `docs/DEVICE_ACCESSIBILITY_ACCEPTANCE_2026-11-12.md`.  
**Release status:** **NOT APPROVED** until physical iPhone/Android installation and accessibility checks are completed.

## Branding and home-screen assets

- Replaced the plain text-C icon with an original, geometric **cream C + gold sparkle on forest green (#073B2A)**. This is *not* an official CPSU seal. Confirm institutional branding approval before public release.
- Added source mark: `apps/web/public/icons/marketplace-mark.svg`.
- Added reproducible, dependency-free Windows icon generator: `scripts/generate-pwa-icons.ps1`.
- Generated distinct normal icons (`icon-192.png`, `icon-512.png`) and separate Android maskable icons (`icon-maskable-192.png`, `icon-maskable-512.png`), plus `apple-touch-icon.png` (180px).
- Verified each PNG's dimensions and its actual color pixels. Maskable emblem outer radii: **52.2 of 76.8px** on the 192px icon, and **139 of 204.8px** on the 512px icon. Both fit in the recommended central 80%-diameter safe circle.
- Manifest preserves `id`, `scope`, `start_url` at `/`, `display: standalone`, cream/forest brand colors and `short_name: CPSU Market`. Android shortcuts: Explore, Sell and Messages.
- The iPhone HTML metadata uses `apple-mobile-web-app-title: CPSU Market`, the same 180px touch icon, and existing standalone/status-bar configuration.
- Service worker cache revision `cpsu-offline-shell-v2` refreshes the icons without caching listings, session data, API requests or private messages.

## Automated validation (local Chrome production-preview emulation)

| Validation | Result |
|---|---|
| Web TypeScript and Vite production build | PASS |
| API unit test suite | PASS: 5 tests; opt-in integration suite skipped by root `bun run test` |
| Isolated MySQL API integration suite | PASS: 18/18 tests (130 assertions), 0 orphan rows, test database only |
| `bun run pwa:check` | PASS: all PNGs, sizes, maskable purposes, metadata and shortcuts |
| Chrome `Page.getAppManifest` | PASS: no manifest errors |
| Chrome `Page.getInstallabilityErrors` | PASS: empty error list |
| HTTPS/localhost secure-context service worker | PASS: controlling page, cache v2 active |
| Cache privacy inspection | PASS: static offline page + 5 icons only; no `/api` entries |
| Responsive: 320, 360, 390, 414, 768, 860, 861, 1024, 1440px | PASS: no horizontal overflow |
| Bottom navigation visibility | PASS: five tabs through 860px, hidden from 861px |
| Touch targets on phones | PASS: ~46.7px tall; hit-test reaches the correct clickable tab |
| Active tab (Home → Explore → Sell → Messages → Profile → Home) | PASS with read-only test-account browser fixture |
| Nested conversation route | PASS: Messages stays active |
| Reply focus / blur | PASS: bottom bar hides on focus and returns on blur |
| 320px viewport with 200% text | PASS: no horizontal overflow or clipped tab labels |
| Desktop preview screenshot | `docs/qa/pwa-mobile-nav-390.png` (Chrome mobile emulation, not a phone screenshot) |

The existing mobile design remains white/cream with forest-green accents and a five-item fixed navigation bar. Selected tab retains the pale-green highlight plus a slim forest-green top indicator. Existing routes, API/DB, seller features and messages were not redesigned.

## Real device installation acceptance — required before production

**Not completed:** The authorized Windows PC has no ADB/Android SDK or connected Android test device and cannot run iOS Safari or iOS Simulator. Chrome mobile emulation and installability metadata verification **cannot prove actual home-screen installation**.

### Android Chrome (physical device, HTTPS deployment)

1. Visit the approved HTTPS marketplace URL in Chrome.
2. Use **⋮ → Install app** (or **Add to Home screen**, depending on Chrome version) and install.
3. Verify home-screen label **CPSU Market** and the forest-green **C + sparkle** icon, without clipping in the adaptive launcher shape.
4. Launch the icon; verify standalone presentation and access to the same login/session and five bottom tabs.
5. Long-press the installed icon; check Explore, Sell and Messages shortcuts *if the launcher supports shortcuts*. Confirm login is requested where appropriate.
6. Test keyboard open/close in messages, safe-area insets, screen rotation, font scaling, back navigation, offline fallback, and reconnection.
7. Test TalkBack, touch-target accessibility, focus behavior, and sign-out/session restoration.
8. If replacing an earlier installation, uninstall/reinstall as needed to ensure the launcher refreshes a previously cached app icon.

### iPhone Safari (physical device, HTTPS deployment)

1. Visit the approved HTTPS marketplace URL in **Safari**.
2. Use **Share → Add to Home Screen**, then confirm the app is added.
3. Check the home-screen label **CPSU Market**, the 180px forest-green icon, and absence of cropping.
4. Launch from the icon and verify browser chrome is hidden as supported, fixed bottom navigation respects the Home Indicator, and text/controls don't overlap on notched phones.
5. Test VoiceOver, Safari back navigation, message composer with virtual keyboard open/closed, app switching, 200% enlarged text, login persistence, and offline fallback.
6. iOS launcher quick shortcuts may not behave the same as Android; do not assume manifest shortcuts are supported by every iOS version.

**Evidence to collect:** physical device/browser/OS version, screenshot of installed icon on the home screen, screenshot of first launch and bottom bar, keyboard open/closed observations, VoiceOver/TalkBack notes, and pass/fail for each step.

## Regeneration, verification and startup

```powershell
# From the repository root
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
bun run pwa:check
bun run api                  # terminal 1
bun run web                  # terminal 2
# From apps/web: bun run build
```

The icon SVG is included as design source; the generated PNGs are the installable outputs. PWA installation on devices requires the published HTTPS origin; `localhost` is suitable for desktop Chrome development, not a remote phone URL.

**Do not deploy until the remaining device, assistive-technology, privacy, and CPSU approval gates have passed.** No GitHub push, commit or deployment is part of this work.
