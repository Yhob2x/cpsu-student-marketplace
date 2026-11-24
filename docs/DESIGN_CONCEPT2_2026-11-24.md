# Concept 2 redesign

**Approved by the project owner:** 2026-11-24 ("Concept 2: Modern Product-Led Marketplace", desktop and phone mockup).
**Stylesheet:** `resources/css/concept-design.css`, loaded last in `resources/js/styles.ts`.

## What changed

| Area | Concept 2 |
|---|---|
| Header (desktop) | One row: logo, Home, Explore (menu with All listings, Products and Services & skills), Sell, Transactions, Profile, Guidelines and Review for staff. Notifications, Install app and an avatar account menu (Profile, Saved, Store insights, Review workspace, Notifications, Sign out). Active page has a green underline. |
| Header (phone) | "CPSU Market", notifications, account menu or Sign in. |
| Bottom bar (phone) | Floating rounded bar: Home (filled when active), Explore (compass), a large raised round Sell button, Inbox with the unread-message badge, and Profile, per the owner's follow-up image. Staff see Home, Explore, Review, Profile. Transactions stays reachable from the Home quick actions, the desktop header and each order link. |
| Home | Hero with eyebrow, serif headline "Buy, Sell & **Connect** on Campus", two calls to action, three trust points and the campus image in an organic frame with floating Buy, Sell and Connect shortcuts. Search card with category and All Filters, icon category chips with All and More, "Trending on Campus", fresh listings, student services and "More Ways to Explore". Phones get the search bar first, a hero card and four quick actions. |
| Listing cards | Photo with a For Sale or Service badge and a heart save button, title, green price, and a seller row with avatar, verified check, store rating and campus tag. Low stock and availability appear on the photo. |
| Explore | Its own keyword search, because search left the header. |
| Admin workspace | Every navigation item has an icon, and the active item has a filled tile. Overview is now a chart dashboard: review workload shortcuts, headline figures with period change, an activity chart, a review-workload donut, the order pipeline, top categories and live listings per campus as bars, and a campus table. It refreshes every 30 seconds while visible. Small student-activity counts stay hidden as <5. |
| Motion | Each new page fades and rises 10 px over 280 ms. Hero shortcuts, menus and cards have short entrances and hover lifts. All of it stops when the device asks for reduced motion. |
| Campuses & categories | Compact rows with a code chip, counts and status badge. Edit and Deactivate or Reactivate are icon-only buttons (pencil, power) with spoken labels and tooltips. Add forms stay folded behind New campus and New category, and categories have a quick filter. Campuses are deactivated, never deleted. |
| Speed | Every page except Home is a separate chunk, prefetched while the browser is idle, so the first load is smaller and later navigation does not wait for the network. |

## Deliberate differences from the mockup

- **Real content only.** Listings, prices, sellers, categories and the hero copy come from the database and the admin Home editor. The mockup's sample laptop, textbooks and coffee listings are not shown.
- **Hero image.** The mockup shows a campus building photo. The app shows whatever an admin uploads in the Home editor's hero slot, and the existing abstract campus artwork until then. No campus photo is invented.
- **Category chips** use the categories admins manage, with short labels and matching icons, instead of the mockup's sample categories.
- **Phone header** has no QR or scan icon, because the marketplace has no scanning feature. The account button sits there instead.
- **Likes and view counts** no longer appear on cards, as in the mockup. They remain on each listing page.
- **Header search** moved into Home and Explore, as in the mockup. Other pages reach search through Explore.
- **Board decorations** around the mockup frames, such as "Product Highlights", are presentation material, not app screens.

## Accessibility

- Every icon-only control has a name.
- Touch targets are at least 44 px, except the 40 px heart, which has a larger hit area.
- Focus rings are visible.
- Menus close with Escape and return focus.
- Text contrast uses the existing tokens.
