# UI/UX guidelines — design system as built

Blueprint PART VIII is the requirement. This file records the tokens, components, navigation, and accessibility behavior that exist, so new
work reuses them instead of inventing parallel patterns (RULE 07).

## 1. Design direction — approved white / forest green storefront (11 November 2026)

The web interface uses one **light-only** theme based on the approved storefront reference: predominantly white
backgrounds, soft neutral product surfaces, clean listing cards, restrained typography, and **deep forest green instead
of black** on the announcement bar, primary actions, active navigation, seller call-to-action, and footer.
The design is minimalist, mobile-first, and student-focused — not a shoe shop. No carts, discounts, star ratings,
delivery claims, payment, fabricated testimonials, or newsletter signup have been added.

Implementation: core colors in apps/web/src/styles.css, reference-inspired presentation overrides in
apps/web/src/storefront-theme.css, and real marketplace content in apps/web/src/pages-public.tsx.
The web uses a single color scheme: light. The former Auto/Light/Dark toggle, OS-based dark CSS overrides,
persisted theme-loading script, and dark-specific browser metadata have been removed.
The native Expo app was not modified by this web-specific request and retains its existing theme support.

## 2. Design tokens — current web

| Token | Hex value | Purpose |
|---|---|---|
| --forest | #073B2A | Dark green strip, banners, footer |
| --pine, --leaf | #10543A | Actions and links |
| --sage | #527866 | Supporting greenery |
| --mint | #D5E8DA | Soft green accent |
| --gold, --mango | #E0BB46 | Price chips and limited functional emphasis |
| --ink | #122A1F | Deep green-black text |
| --ink-soft | #4B6356 | Secondary text |
| --chalk, --paper | #FFFFFF | Page and card backgrounds |
| --mango-soft | #EDF4EF | Pale green interaction backgrounds |
| --line | #DCE6DE | Thin neutral borders |
| --on-leaf | #FFFFFF | Labels on primary actions |
| --danger | #A12A1C | Validation and destructive actions |
| --focus-green | #086043 | Keyboard focus on light surfaces |
| --surface-soft | #F5F7F5 | Category cards and filters |
| --surface-neutral | #F2F4F2 | Hero and product placeholders |

Typefaces remain Plus Jakarta Sans for headings and Inter for body text, with system fallbacks.
Dark-green sections use light keyboard focus outlines. No new dependencies or APIs were introduced.

## 3. Layout

| Concern | Web | Mobile |
|---|---|---|
| Max content width | `.wrap` 1100 px, 1 rem gutters | full width, 12–16 px padding |
| Listing grid | `.grid` auto-fill min 220 px; `.rail` horizontal scroll-snap 230 px cards with category badge and price tag | two-column `ListingCard` grid (`CardGrid` for sections, `numColumns={2}` for lists) |
| Navigation | five-item fixed bottom tab bar on widths ≤ 860 px; desktop uses a masthead and primary nav row | bottom tab navigator |
| Top header | Announcement strip (`--forest`) + light masthead (brand, centred search, activity icons, theme control) + nav row with an "All listings" pill; below 860 px the strip, search, icon row and nav row collapse so the tab bar carries navigation | `Masthead`: strip, brand row and a search entry that opens Explore |
| Safe areas | `env(safe-area-inset-*)` on header and tab bar | `SafeAreaProvider` |
| Breakpoints | fluid typography, tested at 320, 360, 390, 768, 1024 and 1440 px | n/a |
| Admin | same shell, stacked panels | none (no admin in the mobile app) |

## 4. Components to reuse

| Component | Web | Mobile |
|---|---|---|
| Button | `.btn`, `.btn.ghost`, `.btn.danger`, `:disabled` at 55% opacity | `Btn` (`kind="ghost"`, 48 px min height) |
| Input | `.input`/`select`/`textarea` base styles, 44 px min height | `Field` wrapper |
| Card | `.card` + `.card .img` (category badge) + `.card .body` + `.card-foot` (price tag + arrow) | `ListingCard` (photo, badge, seller, campus, price tag, arrow) |
| Price | `.tag` (notched clip-path label) | inline amber chip |
| Status badge | `.status` + status modifier (`published`, `pending_review`, `rejected`, `suspended`) | plain text status |
| Flag chip | `.flag` | none |
| Panel | `.panel`, `.row`, `.stack` | inline styles per screen |
| Error / success | `.err` with `role="alert"`; `role="status"` for success | `Text accessibilityLiveRegion` |
| Loading | `.skel` shimmer cards; `"Loading"` text elsewhere | `ActivityIndicator` |
| Empty state | `.muted` sentence naming the next action | `Empty` component |
| Message bubble | `.msg` / `.msg.mine` | inline mirror of the same shape |
| Category chip | `.chip` | `Chip` (shared by Home and Explore) |
| Section head | `.sec-head` — title + "See all" link | `SectionHead` |
| Category rail | `.cat-rail` / `.cat` / `.cat-ico` circular tile | `CatTile` in a horizontal `ScrollView` |
| Hero | `.hero`, `.hero-art`, `.shot`, `.hero-sticker`, `.hero-trust` | `Hero` card with a single browse action |
| Promo tile | `.promo`, `.promo-a|b|c` | `Promo` (stacked, colour passed as `tone`) |
| Seller call to action | `.cta-band` + `.btn.gold` | forest panel with a gold `Pressable` |
| Trust strip | `.trust`, four icon items | four `✓` lines |
| Footer | `.site-foot`, `.foot-grid`, `.foot-base` | `SiteFooter` (brand, blurb, links, copyright) |
| Page header | `.page-head` (title + supporting line + trailing action) | inline heading |
| Notification row | `.notif`, `.notif.unread`, `.dot` | inline card with a colored border when unread |
| Unread badge | `.nav-badge` in the header "Alerts" link | count text inside Profile |
| Profile layout | `.profile-grid` (auto-fit 290 px), `.facts`, `.quick` | stacked sections |
| Labelled field | `label.field` | `Field` + adjacent `Text` |
| Filter grid | `.filters` (auto-fit 150 px, `align-items: end`) with one `.field` per control | `Chip` row |
| Result bar | `.results` — live-region count on the left, sort `.field` on the right | count implied by the list |
| Empty state | `.empty` dashed panel with a heading, one sentence, and a reset action | `Empty` component |

**Missing shared components** the blueprint asks for (§8.3): modal dialog, table, and a toast/feedback primitive (success and errors are
currently inline `role="status"` / `role="alert"` text). Do not add a UI kit dependency without approval; extend the CSS layer.

## 5. Navigation vs the blueprint (PART VI)

| Required | Web | Mobile |
|---|---|---|
| Home | Header brand + tab; hero, category rail, top picks, promo tiles, fresh listings, student services, how it works, seller CTA, trust strip, footer | Home tab, same order: masthead + search entry, hero, category rail, two-column rails, promos, services, how it works, CTA, trust strip, footer |
| Explore | Tab; filter grid (campus, category, type, min/max price), live result count, three sort orders, clear-filters, purposeful empty state | Explore tab: search + category chips |
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
