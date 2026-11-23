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

### November 17, 2026 — Controlled gold emphasis

The user approved the existing white / forest green / soft-neutral palette and requested more visual distinction **without a new dominant color**. Use the pre-existing warm gold `--mango` / `#E0BB46` selectively: the homepage's primary **Explore listings** action and the small active-page marker in the mobile bottom tab bar. Dark-green foreground on gold maintains readable contrast (approximately 6.81:1). Preserve existing CTA wording, secondary green actions, product-price typography, category surfaces, and semantic status colors. Do not repeat gold indiscriminately across every card or add extra decorative effects.

Implementation: `apps/web/src/student-emphasis.css`, imported after the established component styles in `main.tsx`. Chrome CDP device-emulated checks at 390px and 768px confirmed the exact token colors and no page-level horizontal overflow; web build and focused tests passed. Actual iPhone touch/VoiceOver acceptance remains separate.

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

The admin page uses a section switcher for Listings, Affiliations, Reports, Transactions, and Overview; university administrators also see Students, Staff, Content and Audit history. Only the selected section is shown, so navigation does not jump down a long page. Queue and report counts reflect loaded data. Review decisions retain their required reason and human photo confirmation. Staff has separate reviewer creation and editing forms; staff-only accounts do not see student action navigation.

Student accounts use a server-paged directory (25 records per page), with name/email, campus, account status, and verification filters. The list shows its result range and total; selecting one row reveals the existing status action and required reason. Staff account protection remains enforced by the API.

Administrative audit history uses a compact chronological list with readable action labels, target reference, actor, local date/time, and a recorded reason when one exists. Pagination preserves older entries; retry continues from the failed cursor.

The university-admin Content section provides a plain-text guideline editor with separate Save draft and Publish saved draft actions, plus announcement draft, publish and archive controls. Students see only published content. Guideline headings use `# ` lines; text is rendered as text rather than HTML. The Home page shows up to 10 published announcements and hides the section when empty.

Search and Saved use the shared `.listing-grid` with `auto-fill` tracks at its responsive breakpoints. A single result keeps the normal card and photo width instead of stretching across the content area; additional results retain the existing column layout.

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
- Honor `prefers-reduced-motion` (shimmer, typing dots, and message entry motion are disabled when requested); the web app intentionally ships one light-only forest-green theme.
- No hover-only affordances; the mobile layout must work one-handed with the tab bar reachable.

## 8. Copy conventions

Sentence case for headings and buttons. Prices as `₱` on web (`Intl` en-PH, no decimals) and `PHP …` on mobile. Statuses render with
`_` replaced by a space. Avoid jargon ("storefront", "handoff" is acceptable in the thread only because it is explained in the guidelines page).

## 9. Listing-card refinement — Phase 2 (12 November 2026)

**23 November 2026 update.** Home, Explore, Saved, and storefronts use a shared photo-first card with a 4:3 image and a borderless layout. Save and photo count stay on the image. The title and linked seller name use the full card width. Long titles are visually shortened, with the full title available through the listing link. The icon-only appreciation control sits beside the price and listing metadata. Campus and reported stock or availability follow. Explore's loading state uses the same photo proportions.

- **Single reusable card:** `ListingCard` in `apps/web/src/pages-public.tsx` is shared across Home, Explore, Saved, and store pages; keep all listing and save actions unchanged.
- **Reading space:** card text has 8 px horizontal padding on phones and 10 px on larger viewports, while photos remain frameless and the Product/Service badge and 44 px save target keep their positions.
- **Long metadata:** category and product condition may wrap into separate lines; seller and campus names retain their one-line truncation and full text in their title attributes.
- **Prices:** preserve the complete peso amount and allow a meaningful rate basis to wrap below it instead of collapsing into an unreadable suffix.
- **Images:** absent media keeps “No photo yet”; failed media requests show “Photo unavailable” without a broken-image icon. A changed image URL can render normally even after the previous URL failed.
- **Enlarged text:** listing-grid columns adapt to text size while preserving normal-size breakpoints of two columns on phones, three on small tablets, four on medium screens, and five on wide screens.
- **Verification:** production web build and API unit tests pass. Headless Chrome checks at 320, 360, 390, 768, 1024 and 1440 px with long values, max price, failed images, and 200% text size found no horizontal overflow. Physical-device checks remain necessary.

## 10. Mobile interaction polish — Phase 3 (12 November 2026)

- **Touch response:** links and buttons use `touch-action: manipulation` and controls provide immediate `:active` feedback without disabling pinch-to-zoom. Browser tap highlights are suppressed; content text remains selectable and card links retain long-press link actions.
- **Pointer capability:** hover effects apply only to `(hover: hover) and (pointer: fine)`; keyboard focus states remain independent and visible. Reduced-motion preferences continue to disable decorative transitions.
- **Safe areas:** the web viewport declares `viewport-fit=cover` and `interactive-widget=resizes-content`. Header/page gutters and mobile tab-bar padding respect available safe-area insets; the light-only forest-green theme remains unchanged.
- **Footer:** marketplace, account, and support links provide at least 44 px of touch height.
- **Conversation keyboard:** the reply field sets `enterKeyHint="send"`; the message log stops scroll chaining. While the reply field is focused on narrow screens, the fixed tab bar hides and the message log shrinks. `visualViewport` resize and scroll events reserve extra space and scroll the composer above overlaid mobile keyboards when needed. The behavior does not change message submission or the follow-latest scroll rule.
- **Checks:** local TypeScript/Vite build, API unit tests, desktop browser breakpoint inspections, touch emulation and a simulated keyboard overlay. Test a real iPhone/Android handset (notch, keyboard open/close, Safari's viewport handling, and long-press) before production deployment.

## 11. Chat motion and truthful receipts — 12 November 2026

- **Server receipt contract:** InquiryMessage already has deliveredAt and seenAt (existing 20261110090354_message_status migration). Message retrieval by the recipient sets deliveredAt. POST /inquiries/:id/seen accepts a validated positive upToId and updates only that recipient's incoming messages at or below the observed ID, after authorization. No migration or new dependency was needed.
- **Meaning:** Sent = persisted on server; Delivered = recipient fetched the conversation; Read = recipient's visible, focused conversation client acknowledged the message in view. The API does not claim to determine whether the person physically read the words. Closed threads remain readable. No sender can mark their own messages read.
- **Inbox:** If the most recent message belongs to the current user, show a compact one-check gray Sent, two-check gray Delivered, or two-check forest-green Read status below the preview.
- **Conversation:** Use one Today/Yesterday/date divider per calendar-day change; use one concise timestamp at the end of each same-sender run, and show the receipt only beneath the user's latest outgoing message. Dark forest-green outgoing bubbles, white incoming bubbles, and matching green send action preserve the light-only palette.
- **Animation:** New messages only enter upward 12px over 240ms, never reanimate old history on polling; the existing typing heartbeat drives three gently staggered dots. Both motions switch off with prefers-reduced-motion.
- **Read visibility:** Only incoming messages at least 50% visible within an active, focused thread are acknowledged. Already seen messages are excluded and newer messages beyond upToId are untouched. A missed acknowledgment can retry on later refresh/visibility.
- **Verification:** Production web build; direct API TypeScript; isolated MySQL integration including sender/recipient/outsider/partial-read lifecycle; headless Chrome at 320, 390, 768, 1440 px. Physical-device and assistive-technology walkthrough remain release QA items.

## 12. Chat alignment, timestamps, contrast, and presence (12 November 2026)

- Chat layout follows physical left/right edges: inbound left, own messages right. Repeated avatar initials and visible sender names are removed from the thread; author and full timestamps remain available to assistive technologies, while the inbox retains its listing avatar.
- Same-sender runs: **4px** vertical spacing; sender switches: **18px** spacing; bubble corner radius: **20px** with one smaller trailing corner.
- One **date divider** appears per calendar-day transition. The **single visible timestamp** follows the newest message in a thread; older exact timestamps remain in bubble tooltips and accessible labels.
- Outgoing bubble and send button use the existing accent green `#10543A`; white bubble text has **8.93:1** measured contrast, exceeding the requested 8.3:1 minimum. Incoming messages stay white. Receipt text remains directly below the latest outgoing message.
- The header shows **Online** only when the other conversation participant has sent a heartbeat from a visible, focused chat tab within 25 seconds. Without such evidence, show **Not active in chat**, which makes no claim about their status elsewhere. Presence is ephemeral and participant-only; no profile-wide tracking, app-global presence, migration, or new dependency.
- Sent -> Delivered -> Read transitions remain grounded in server events. Receipt updates get a subtle 240ms fade/slide and new messages retain their 240ms upward entry. Typing dots use the existing typing heartbeat. All animation is disabled by prefers-reduced-motion.
- Validated in browser at 320/390/768/1440px: no page overflow, exact 4px/18px spacing, 20px radius, one divider/time, correct accent background, and correct Online/Not-active responses; 240ms/0ms motion verified. Physical-device and screen-reader QA remain open.

## 13. Participant names in Messages (12 November 2026)

- **Online** refers to a recent heartbeat from the other participant while their **specific conversation** tab is visible and focused. It does not indicate account login, inbox viewing, or general site activity. Heartbeats recur every 10 seconds and expire after 25 seconds. Typing dots and Sent/Delivered/Read remain independent signals.
- In the `/inquiries` inbox, use the other participant's **User.displayName** as the primary card title and avatar initials, with the listing title as secondary `About:` context. A last message authored by the viewer is prefixed `You:`. Preserve the buyer/seller role, time, closed status and receipt.
- In a conversation, use the other student's name as the header title with the accurate chat-scoped presence status underneath. Do not reintroduce repeated names into each message bubble.
- The API selects the seller owner name for the buyer and buyer name for the seller, based on participant-checked thread relationships. Never disclose unrelated users' names or include email/password details.
- Browser checks at 320, 390, 768 and 1440px confirmed names, contextual listing, avatar initials, outgoing `You:` prefix, thread heading, and no horizontal overflow. Isolated API integration verified reciprocal name selection and absence of email leakage.

## 14. Notifications feed refinement — 12 November 2026

- Responsive web/PWA route `/notifications` follows the approved single-light white/forest-green theme. Its CSS is isolated in `apps/web/src/notifications.css` and imported after shared styles in `apps/web/src/main.tsx`.
- Layout: notifications heading + refresh, dark-green unread summary with a bulk mark-read action, two accessible `aria-pressed` filters (All / Unread), and date groups (Today / Yesterday / Earlier). The API returns only the most recent 50, so the page states that limit instead of claiming the complete historical archive.
- Each row retains the existing backend message, listing, and affiliation notification logic, but presents a clear title, contextual text, time, type icon, and visible New state for unread items. Linked content navigates to its existing destination and attempts mark-read; a separate Mark read button is available without navigation, including for unknown notification types that have no destination.
- All controls respect 44px minimum target height, visible keyboard focus, semantics, adequate text wrapping and contrast, and reduced-motion settings. No new library, server route, database model, user permission or notification delivery channel was added.
- Async states: loading skeleton, purpose-specific empty state, filtered-empty state, descriptive load error with retry, retained existing rows after failed refresh, confirmation for successful mark-read operations. Refresh and action buttons expose pending/disabled states; read badge in the shell synchronizes with server after actions.
- Verification: TypeScript/Vite production build passed. Headless browser evaluated 7 simulated notification types at 320, 360, 390, 768, 1024, 1440px: no horizontal overflow, 44px controls, filters, dated grouping, per-item read, bulk read, error preserving previously loaded records, and successful empty states. Separate checks covered first-load failure/retry, unrelated notification without a link, and mark-read/navigation to a real route path. All browser data was mocked; production marketplace rows were not modified. Physical-device and manual screen-reader checks remain release QA items.

## 15. Conversation-start listing card — 12 November 2026

- Each `/inquiries/:id` conversation shows one compact listing-context card at the **beginning of the message log**, immediately after the first date divider and before the first message. Existing scroll-to-latest behavior is preserved for established conversations.
- The card uses **real thread listing data**: first photo by media position, listing title, Product/Service type, peso price and optional rate basis, optional product condition, actual availability, and listing ID. No fictional order ID, order total, shipping state, payment or checkout flow is displayed.
- It uses the approved white/forest-green theme, 4/8px spacing rhythm, shrinkable columns, reserved square image space, full-name semantics and a no-photo/image-failure fallback. The listing link has a 44px hit target; condition is omitted for services.
- The existing participant-authorized messages API includes a narrowly whitelisted `listing` summary. When a listing is no longer published/approved, the thread remains readable but the card says **Listing unavailable** and the API does not return a private photo URL.
- Verified: web TypeScript/Vite build, API TypeScript check, five unit tests, 18 isolated MySQL integration tests with 130 assertions, and test DB integrity audit. Device screenshot comparison, browser layout and manual screen-reader acceptance remain open before production approval.

## 16. PWA launcher and bottom navigation — 12 November 2026

- Use the original forest-green/cream/gold CPSU Market C-and-sparkle mark for web/PWA home-screen images. This is **not** an official CPSU crest; institutional branding remains subject to approval.
- Android requires two icon purposes, `any` and `maskable`, at 192px and 512px; the maskable mark must remain inside the central 80%-diameter safe area. iPhone uses the 180px Apple touch icon and short label **CPSU Market**.
- The unified responsive app retains the same bottom navigation on phones: **Home, Explore, Sell, Messages, Profile**. Keep it fixed, safe-area aware, with icons, visible labels, 44px+ touch targets, a pale-green selected-tab background, and a subtle forest-green top marker.
- Use `NavLink`'s `aria-current="page"` for active indication, including nested Messages routes. Hide the bar while the conversation reply textarea is focused so the keyboard cannot cover the input.
- Tested in local Chrome at 320/360/390/414/768/860/861/1024/1440px, including 200% text at 320px: no clipped labels or horizontal overflow; mobile navigation hidden above 860px. Activated all five routes and verified nested Messages and chat focus transitions using a read-only browser fixture.
- The offline fallback explains that live listings and messages require a connection. Do not cache API data or authenticated pages. Real iPhone/Android launcher, safe-area and VoiceOver/TalkBack acceptance **remain required**.

## 17. Mobile content-first UX — 12 November 2026

- On phones and tablet widths using the fixed five-item navigation, prioritize marketplace content over the decorative Home collage. Desktop artwork and the forest-green/white theme are unchanged.
- Home must bring category browsing into view earlier: at 320px the compact hero is approximately 508px tall instead of 847px, at 390px it is approximately 394px rather than 682px. Avoid hiding essential trust, action, or search copy; the art is decorative.
- Mobile Explore has immediate All / Products / Services buttons, each with `aria-pressed`, using the same URL-filter state as the existing desktop select. Advanced filters are collapsed initially below 640px and the mobile toggle has `aria-expanded`, `aria-controls`, and an active-filter count.
- Opened advanced fields occupy a full column at 320px, preventing severely abbreviated option labels. Desktop keeps its full-width three-column panel. Reset still clears the URL and restores the type chips.
- Preserve two-column listing cards on standard phones and allow the existing rem-based grid to collapse for magnified text. Keep readable typography, 44px save controls, and at least 48px app-bottom-tab targets.
- Browser checks cover 320/360/390/414/560/768/1024px, interaction states, 200% text, no horizontal overflow, and Axe-core on Home/Explore/Login at 320/390px (0 confirmed violations; card contrast computations still require manual review).
- Do not treat Chrome emulation as real iPhone/Android verification. Physical device keyboard/safe-area, PWA install, and VoiceOver/TalkBack tests remain release blockers.


## 18. Seller upload content policy and reviewer confirmation — 16 November 2026

- Seller create/edit forms describe prohibited image categories (pornography, explicit sexual imagery, graphic violence and similar prohibited material) adjacent to the file control with an accessible description.
- The server validates and re-encodes new images; this **does not classify the subject matter**. Do not present the upload as being automatically scanned for pornography.
- Review queue shows every attached photo and the count. A previously unchecked human-review confirmation is required before the Approve button becomes enabled. Request changes and Reject continue to work without approving any content.
- The server requires the confirmation even when an API client bypasses frontend controls. Review decisions retain their reasons and the authorized review scope; confirmation and photo count are audited.
- A newly added photo to an existing published listing sends the listing back to draft. Show a clear status message to the seller that resubmission is required, rather than implying the photo is instantly public.
- Continue the existing approved light/forest-green design, visible labels, keyboard controls, and screen reader feedback. Device and screen-reader acceptance remains pending.

## 19. New incoming-message sound, no send sound (16 November 2026)

- **Send is silent.** Only an actually new incoming message identified through the authenticated current-user chat or inbox API may ring. Sending a message, loading an existing conversation, repeated polling, a batch of existing messages or the first catch-up after returning from another app never rings.
- The `/inquiries/:id` conversation checks new IDs on its existing ~3-second poll; the `/inquiries` inbox checks new last-message IDs on a ~5-second poll while that inbox is mounted. Each successful foreground refresh with new inbound messages triggers **one** original ~580ms 'ting' bell, not one per message. Foreground requires a visible, focused page. A transient inbox refresh failure preserves existing results.
- **Sound on / Sound off** and **Test sound** appear in both screens, with accessibility labels and mobile-friendly controls. The browser saves the opt-out, including the previous send-sound mute preference until a dedicated receive-sound choice is set.
- On iPhone Safari the user should tap **Test sound** once to unlock audio; a silent user-gesture Web Audio preparation also runs when interacting with the chat. Browser autoplay limits, Silent Mode and Bluetooth output routing may prevent actual speaker playback. This remains **foreground in-app sound**, not background/lock-screen Web Push.
- No third-party ringtone file is downloaded or embedded. The Zedge 'iPhone'/'ting' listing is only a style reference for the original synthesized WAV. No server, migration, permission, paid API or Web Push release-switch change. Validation and the physical device checklist: `docs/IPHONE_MESSAGE_RECEIVE_SOUND_2026-11-16.md`.

## 20. Student listing actions and My Store task order — 17 November 2026

- On a public listing, show the request action in its own "Ready to proceed?" area. Keep the inquiry control with the message field and style it as secondary so students can distinguish a purchase request from a question.
- After an inquiry succeeds, link directly to its returned conversation route. Save and report feedback must not reuse that link.
- Keep My Store focused on New listing and the paged listing collection. Place store name, description, and picture editors in the student Profile page at `/profile#store-profile`. Link there from My Store, Profile quick links, and the owner's public storefront.
- The web TypeScript check and production build passed. Rendered mobile, keyboard, and physical-device checks remain pending.

## 21. Student Profile hierarchy — 17 November 2026

- Keep account identity and campus verification visible first. Place account editing and quick links before the longer store forms, so everyday student actions remain easy to find on phones.
- Present store name, description, and picture editing inside a native disclosure in Profile. The Store profile shortcut and direct `/profile#store-profile` links open the disclosure and bring its summary into view.
- Preserve the existing seller editors, server authorization, validation, save feedback, and public store links. Staff accounts never see the student store editor.

## 22. Registration information in student Profile — 17 November 2026

- Show Student ID number, full name, campus, enrollment status, and display name together in one Registration information card. The first four rows are read-only; the display-name field is the only editable registration detail. Staff retain their separate Account settings card. The campus row uses the student's current affiliation data; it must not imply a CISS match.
- Within that card, place the read-only registration rows beside Account settings on wider screens. Stack them in the same reading order on phones, with no horizontal scrolling.
- Explain the planned checks beside each field. Mark Student ID and full name as unavailable in Profile and enrollment as not checked while private identity reads and the CISS connection are not approved or active. Never fabricate an identifier or present campus review as automated enrollment verification.
- Keep sensitive identity fields out of the public profile and existing `/me` response. No CISS request, identity read endpoint, collection switch, migration, or new verification decision is introduced by this UI preparation.
