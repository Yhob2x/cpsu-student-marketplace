# UI/UX guidelines — design system as built

Blueprint PART VIII is the requirement. This file records the tokens, components, navigation, and accessibility behavior that exist, so new
work reuses them instead of inventing parallel patterns (RULE 07).

## 1. Design direction

A friendly, low-chrome community marketplace: warm paper background, deep green action color, one amber accent reserved for price tags and
attention. No gradients, no decorative illustration, no dashboard widgets. Web and mobile share the same palette and type intent, but not
component code.

## 2. Tokens

**Web** — CSS custom properties in `apps/web/src/styles.css`, with a full dark override under `prefers-color-scheme: dark`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#1b2838` | `#eef2ef` | body text, header background |
| `--ink-soft` | `#52606f` | `#a9b5b0` | secondary text (`.muted`) |
| `--chalk` | `#f4f6f3` | `#121a17` | page background |
| `--paper` | `#ffffff` | `#1a2420` | cards, panels, inputs |
| `--leaf` | `#1d6b50` | `#5fc29c` | primary action, links |
| `--leaf-dark` | `#124a37` | `#8fdcbc` | reserved |
| `--mango` | `#f5a623` | `#f5a623` | price tag, focus ring |
| `--mango-soft` | `#fdebc6` | `#3a2f14` | image placeholder, own message bubble, flags |
| `--line` | `#d9dfd9` | `#2e3b36` | borders |
| `--danger` | `#b3261e` | `#ff8a80` | destructive actions, errors |
| `--font-display` | Bricolage Grotesque → system-ui | same | h1–h3, brand, price tag |
| `--font-body` | Public Sans → system-ui | same | everything else |

**Mobile** — `apps/mobile/src/theme.ts` exposes `useTheme()` returning `{ ink, soft, bg, card, line, leaf, mango, danger, onLeaf }` for light
and dark. Note: mobile has **no** `mangoSoft` token; existing screens hard-code `#fdebc6` for the image placeholder and the own-message bubble,
which is the one place mobile drifts from the web palette.

## 3. Layout

| Concern | Web | Mobile |
|---|---|---|
| Max content width | `.wrap` 1100 px, 1 rem gutters | full width, 12–16 px padding |
| Listing grid | `.grid` auto-fill min 220 px; `.rail` horizontal scroll-snap 230 px cards | `FlatList` rows, 84 px thumbnail |
| Sticky navigation | fixed `.tabbar` (mobile-first) + top header with inline links | bottom tab navigator |
| Safe areas | `env(safe-area-inset-*)` on header and tab bar | `SafeAreaProvider` |
| Breakpoints | none defined; layout is fluid (`clamp()` for h1) | n/a |
| Admin | same shell, stacked panels | none (no admin in the mobile app) |

## 4. Components to reuse

| Component | Web | Mobile |
|---|---|---|
| Button | `.btn`, `.btn.ghost`, `.btn.danger`, `:disabled` at 55% opacity | `Btn` (`kind="ghost"`, 48 px min height) |
| Input | `.input`/`select`/`textarea` base styles, 44 px min height | `Field` wrapper |
| Card | `.card` + `.card .img` + `.card .body` | `ListingRow` |
| Price | `.tag` (notched clip-path label) | inline amber chip |
| Status badge | `.status` + status modifier (`published`, `pending_review`, `rejected`, `suspended`) | plain text status |
| Flag chip | `.flag` | none |
| Panel | `.panel`, `.row`, `.stack` | inline styles per screen |
| Error / success | `.err` with `role="alert"`; `role="status"` for success | `Text accessibilityLiveRegion` |
| Loading | `.skel` shimmer cards; `"Loading"` text elsewhere | `ActivityIndicator` |
| Empty state | `.muted` sentence naming the next action | `Empty` component |
| Message bubble | `.msg` / `.msg.mine` | inline mirror of the same shape |
| Category chip | `.chip` | `Chip` (shared by Home and Explore) |
| Page header | `.page-head` (title + supporting line + trailing action) | inline heading |
| Notification row | `.notif`, `.notif.unread`, `.dot` | inline card with a colored border when unread |
| Unread badge | `.nav-badge` in the header "Alerts" link | count text inside Profile |
| Profile layout | `.profile-grid` (auto-fit 290 px), `.facts`, `.quick` | stacked sections |
| Labelled field | `label.field` | `Field` + adjacent `Text` |

**Missing shared components** the blueprint asks for (§8.3): modal dialog, table, and a toast/feedback primitive (success and errors are
currently inline `role="status"` / `role="alert"` text). Do not add a UI kit dependency without approval; extend the CSS layer.

## 5. Navigation vs the blueprint (PART VI)

| Required | Web | Mobile |
|---|---|---|
| Home | Header brand + tab | Home tab: intro, search entry, category chips, recently added, student services |
| Explore | Tab | Explore tab: search + category chips |
| Sell / Offer | "Sell" tab → `/dashboard` | **Absent** — publishing stays web-only (KI-027) |
| Messages | "Messages" tab → `/inquiries` | Messages tab |
| Profile | Profile tab → `/profile`: identity, affiliation, account settings, links | Profile tab: identity, notifications, my listings, saved, sign out |
| Notifications | `/notifications` plus an "Alerts" badge in the header | Inside Profile |
| Admin (Dashboard, Students, Listings, Transactions, Reports, Categories, Announcements, Analytics, Audit Logs, Settings) | Single `/admin` route with review queue + analytics | none |

Web now matches PART VI's five destinations; on mobile the same five exist, with Saved and Notifications under Profile exactly as PART VI
places Favorites there. Mobile Sell/Offer is the remaining divergence and is tracked as KI-027, because the native client has no listing
composer yet. The admin area still has no sub-navigation for the sections it does not implement.

## 6. Interaction rules

1. **No confirmation dialogs** for reversible actions (save/unsave, report cancel). Destructive admin actions require a typed reason instead.
2. **Reasons are visible to the affected seller** on every moderation decision; the reason field is required before the buttons enable.
3. **Errors say what to do next**, not just what failed (`apps/web/src/api.ts` `MESSAGES` map; mobile `MSG`). New error codes must be added to
   both maps.
4. **Money is never implied to be handled by the platform.** Listing and thread copy states that payment and handoff are arranged directly.
5. **Badges never imply endorsement**: "Verified CPSU community member" plus an explicit disclaimer on the store page.
6. **Loading, empty, and error states are mandatory** for every data screen (RULE 09).

## 7. Accessibility requirements

- Minimum 44 px targets on web, 48 px on mobile (already the norm).
- `:focus-visible` ring: 3 px `--mango`, 2 px offset — do not remove outlines.
- Every input has a visible label or `aria-label`; every async result is announced (`role="alert"` / `role="status"` /
  `accessibilityLiveRegion`).
- Contrast: body text on `--paper` and white on `--leaf` pass AA at these values; **verify** any new color pair.
- Honor `prefers-reduced-motion` (shimmer animation is already disabled) and `prefers-color-scheme` (both themes ship).
- No hover-only affordances; the mobile layout must work one-handed with the tab bar reachable.

## 8. Copy conventions

Sentence case for headings and buttons. Prices as `₱` on web (`Intl` en-PH, no decimals) and `PHP …` on mobile. Statuses render with
`_` replaced by a space. Avoid jargon ("storefront", "handoff" is acceptable in the thread only because it is explained in the guidelines page).
