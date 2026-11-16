# My Store UI/UX polish — 16 November 2026

Scope: existing web/PWA seller dashboard only. The approved white and forest green storefront, seller permissions, listing states, form validation, API calls, and deletion rules are unchanged.

The create form now sits in a native disclosure so existing listings remain near the top of the screen. Seller listings show a stronger title and price hierarchy, separate moderation and availability badges, short status guidance, and grouped actions. A listing count, first listing empty state, compact affiliation panel, and responsive action layout improve scanning on phones. Styles are scoped to `my-store.css`.

No backend, database, migration, package, or approval scope change. TypeScript checking passed with `node_modules/.bin/tsc.cmd --noEmit -p apps/web/tsconfig.json`. The production bundle passed with Vite's `--configLoader runner` (49 modules); the default bundled config loader hit a Windows sandbox directory access denial. The Impeccable detector returned `[]`, and `git diff --check` passed. Browser and physical device acceptance remain outstanding. Graphify update was attempted but blocked because its configured Python executable is inaccessible.

## Follow-up: many listings

The seller list now shows six listings per page, with title search and a moderation-status filter. The result range and total are visible, empty search results have a clear-filters action, and Previous/Next buttons return keyboard focus to the list heading. Filtering and paging happen in the web client on the existing owner-scoped seller response, which is already ordered by most recent update. No API or database change was needed.

Follow-up verification: TypeScript check, Vite production build with runner loader (49 modules), `git diff --check`, and Impeccable detector (`[]`) passed. Authenticated browser and device checks remain outstanding.

## Follow-up: product cards

The seller list now uses image-first cards. Each card uses the first listing photo by media position, or a no-photo/photo-unavailable fallback; it shows the existing category, title, price, review status, availability, and seller controls. A published card can link to its public listing. Private drafts are not linked to the public detail route, and the owner-only photo endpoint remains protected by the existing media cookie and server checks. Cards form a grid on wider screens and a compact horizontal layout on phones. Search, status filtering, and six-per-page controls remain in place.

Verification: TypeScript check, production Vite build (49 modules), `git diff --check`, and Impeccable detector (`[]`) passed. A temporary static fixture using the actual CSS was visually inspected at 500 and 1024 CSS px; cards and controls fit those widths. The preview files were removed. The local web/API servers were unavailable for authenticated visual QA, so actual data, narrow phone, and device acceptance remain outstanding. No backend, database, or package changes.

## Follow-up: sell the same product again

Approved C4 in `MASTER_BLUEPRINT.md` keeps a sold listing terminal; WP3 also links physical-product completion to sold inventory. This UI change stays within the existing MVP create-listing flow: a sold, published physical-product card offers **Sell again**, which opens a new listing form prefilled with title, category, condition, description, price, and price basis. It never reopens the sold record or copies its media. The seller reviews the details, adds a fresh photo, saves a new draft, and submits it through the existing campus review. Server ownership, verification, validation, and review rules remain in force. Unsaved create-form changes require confirmation before replacement or clearing.

No API, schema, migration, or database changes. Web TypeScript and Vite production build passed. An isolated mock-browser check was attempted, but Chrome DevTools did not answer `Page.enable`; no interaction result was obtained. Its temporary server, browser profile, and script were removed. Authenticated end-to-end and device QA remain outstanding.

## Follow-up: sold services

The same **Sell again** shortcut now appears on sold, published service cards, including the Graduation photoshoot example. It preloads the service category, title, description, rate, and rate basis into a new draft. Product condition remains omitted for services, as required by the existing API. The old sold listing stays sold, and a new photo or portfolio image must be uploaded before the new draft can pass submission review. No backend or database change.
