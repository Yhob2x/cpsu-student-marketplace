# Editorial UI redesign — 18 November 2026

## Scope

Frontend presentation only. The reference image supplied by the owner guides the warm campus palette, editorial display type, organic photo framing, search panel, category tiles, listing cards, and forest green calls to action. Existing routes, API contracts, listing data, permissions, search, saved items, messaging, notifications, transactions, seller tools, and review workflows remain in their original components.

The homepage uses real listing media and category responses. When no listing media is available, a local decorative campus marketplace illustration fills the hero. The illustration does not represent a real CPSU location, person, listing, or endorsement. The hero search still submits to the existing Explore route; its mobile control retains the compact icon presentation.

## Files and decisions

- `apps/web/src/editorial-redesign.css` is the final presentation layer. It maps the existing component classes to the reference palette and spacing while retaining the current responsive and accessibility behavior.
- `apps/web/src/pages-public.tsx` changes homepage presentation text and groups the existing search input and submit control in a visual panel. The same submit handler and listing/category APIs remain.
- `apps/web/src/main.tsx` imports the presentation layer last.
- `apps/web/index.html` loads DM Serif Display with Inter for the reference's editorial heading and compact UI pairing.
- `apps/web/public/illustrations/campus-market.svg` is the decorative fallback for an empty hero media response.

No API, schema, migration, dependency, or route was changed.

## Verification

- Web `bun test`: 73 passed, 0 failed.
- Web `bun run build`: TypeScript and Vite production build passed.
- Chrome device emulation on the local production preview: homepage at 320, 360, 390, 768, 1024, and 1440 CSS px; no document horizontal overflow. Explore and sign-in at 390 px and Explore at 1440 px also had no overflow.
- Screenshots were inspected at phone, tablet, and desktop widths. The desktop hero and categories loaded actual development listing data. The tablet photo composition and phone search/category layout were visually checked.
- `git diff --check` passed.

Physical phone browsers, screen readers, signed-in workflows, and a complete reference-image pixel comparison remain unverified. Existing automated tests cover component behavior but do not prove every authenticated workflow end to end.

## Lower homepage continuation

The owner then requested the reference's lower-page composition while retaining CPSU details. The existing listing card now has a decorative arrow cue beside its campus line; its stretched listing link, seller link, save control, data and error feedback remain unchanged. A forest trust band groups the four existing safety facts after marketplace discovery. The existing three-step guidance sits beside the local illustrative marketplace artwork and links to the real Guidelines route. The existing seller action is presented on a rust-colored campus panel; the install prompt and role-aware footer keep their original controls and links. No student stories, endorsements, ratings, payment features, or invented listings were added.

The follow-up web build passed, and the 73 existing web tests passed. Chrome device emulation found no document overflow at 320, 360, 390, 768, 1024 or 1440 CSS px. Lower-page screenshots were inspected at 390, 768 and 1440 px. Physical device and signed-in workflow checks remain open.

## Owner-requested admin editing follow-up

The owner subsequently asked to edit the designed homepage's **text and images** in the admin interface. A global university administrator can now edit the homepage editorial copy and three image slots (hero, how it works, seller banner) in Admin > Content. Text and images are saved to a private draft. Publishing applies the complete saved draft together; revision checks prevent one administrator from silently overwriting another's changes. Images are converted to WebP using the existing upload sanitizer and media storage, and only the published versions have public image routes. Existing listing and category data, search, links, and student actions remain data-driven.

The additive `HomePageContent` migration is present in source but has **not** been applied to the development or production database. Until it is applied, the public page keeps the shipped design and the admin editor reports that activation is needed. Isolated `cpsu_marketplace_test` migration and authorization/publication tests passed. This section supersedes the earlier frontend-only scope statement for this separate owner request.

### Local development activation — 18 November 2026

The owner subsequently authorized continuing the build after the missing homepage migration was identified. `20261118120000_managed_home_page_content` is now applied **only** to local `127.0.0.1:3306/cpsu_marketplace`. The guarded activation script `apps/api/scripts/home-page-approved-dev-activation.ts` checked the exact migration SHA-256 `bfe9c06ec22662c91c8dbdc9d0472ba30e1cd9bf0330a1f16f63d484a7decb99`, created a private retained SQL and upload backup, restored it to a disposable database, rehearsed the one-table migration, and verified all existing rows unchanged before and after local activation. The successful pre-activation backup is `C:\Users\acer\AppData\Local\CPSU-Marketplace\backups\home-page-dev-2026-11-18T01-26-46-523Z-f02794` (SQL SHA-256 `60839d177e48db838e8fc7e2d465b1938ebe89e013e95058be307b2ec432b78c`, 448,805 bytes, 24 upload files). The disposable restore was removed. Prisma's migration ledger now records only this new migration; the older managed-content, announcement-edit and private-student-identity migrations remain pending. No production database was changed.

## Homepage hero polish

The owner supplied a screenshot showing that the automatic three-image collage could pull unrelated listing photos into the hero. The default hero now uses the existing campus marketplace illustration; a published administrator-selected hero image still takes precedence. Removed the large decorative shapes and sticker, placed search within the hero, and kept the existing Explore link, administrator-editable search heading, and search submission. On narrow screens the illustration follows the actions and the search input shrinks beside its submit button. Listing feeds and all other homepage sections remain data-driven. No API, database, or migration changes were made for this polish pass.

The web suite passed 75/75 and the Vite production build passed. Desktop and narrow-window Chrome screenshots were inspected. The Chrome command-line narrow-window capture does not provide device emulation, so an actual 390px viewport and physical phone check remain unverified.

## Restored artistic hero

The owner then requested the earlier screenshot composition again, with its cream, forest, mustard and rust palette, curved artwork frame, large three-line headline, two actions, compact reassurance points and overlapping search panel. The default hero now uses `campus-abstract.svg`, a decorative nonfigurative placeholder. A published administrator-selected hero image replaces it in the same frame. The search form still submits to Explore; Start selling still uses the existing dashboard route. Managed headline and body text remain editable through Admin > Content. No API, schema or migration changes were made for this layout restoration.
