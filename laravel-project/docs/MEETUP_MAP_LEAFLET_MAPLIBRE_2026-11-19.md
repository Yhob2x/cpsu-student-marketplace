# CPSU Market — Meetup Map (Leaflet + MapLibre)
Date: 2026-11-19
Scope: Existing local web/PWA and transaction/handoff routes. No database migration, GPS tracking, paid map API, or payment changes.

## Experience
- In an accepted or negotiating transaction, students can open **Choose meetup pin**. Already-confirmed meetups can be revised with explicit acknowledgment; both confirmations reset and the status returns to negotiating. Edits are blocked once completion starts or the transaction closes.
- Map uses Leaflet interaction and MapLibre vector basemap (OpenFreeMap Liberty), with OpenStreetMap raster fallback when WebGL is unavailable. Libraries/styles are downloaded only after the map is opened; no map tiles are cached by the PWA service worker.
- Enter a human-readable public meeting spot and agreed day/time, tap the map to place a pin or use **Pin map center** for keyboard accessibility.
- Save with the participant-scoped PUT /api/v1/transactions/:id/meetup-location.
- Both students can inspect the saved location on transaction detail and use its fixed OpenStreetMap link; the existing conversation handoff summary also links to the map.
- Map selection is self-reported; it does **not** confirm the meetup or completion, change canonical transaction status, or validate a real-world address.

## Storage and authorization
- Uses the existing private Handoff.generalLocation string: `Place description [geo:latitude,longitude]` with five decimal places. Old text-only handoffs display as before. The server validates label length, time window, numeric finite coordinates and world bounds.
- Both transaction detail and the new save endpoint require a verified participant; public listings do not expose pins.
- Saving updates the handoff's time and place as a proposal while retaining any existing method. It writes an audit entry.
- The participant-only endpoint uses an atomic transaction-row update. Revision of previously confirmed details requires resetConfirmations=true and clears both confirmations, logs the status transition and notifies the other party. The legacy PUT /inquiries/:id/handoff route still blocks changes to confirmed arrangements, so older callers cannot bypass the explicit re-confirmation step.
- No background geolocation, search/geocoder, route calculation, personal location disclosure, or third-party account required.
- Basemap tile requests go to OpenFreeMap, or OpenStreetMap standard tiles on the raster fallback. Review provider attribution, usage policy and traffic capacity before deployment. Tiles require an internet connection.

## Implementation
- apps/web/src/meetup-map.tsx and meetup-map.css — lazy map, Leaflet adapter, MapLibre tiles, raster fallback, clickable marker
- apps/web/src/meetup-location.ts — backward-compatible pin encoding/decoding and safe map links
- apps/web/src/meetup-location-card.tsx — location form, confirmation lock state, feedback, map preview
- apps/web/src/pages-transactions.tsx — transaction detail integration
- apps/web/src/pages-account.tsx — full-page conversation map link
- apps/web/src/floating-chat-panel.tsx and floating-chat.css — in-chat map sheet for viewing and sharing meetup pins, including conversations without a purchase request
- apps/web/test/floating-chat-meetup.test.tsx — floating chat regression tests
- apps/api/src/meetup-location.ts — server input schema and serialization
- apps/api/src/routes/transactions.ts — participant-scoped, concurrency-guarded save
- apps/api/src/routes/inquiries.ts — legacy handoff lock enforcement
- apps/web/src/api.ts — readable locked-arrangement error
- apps/web/package.json and bun.lock — leaflet, maplibre-gl, @maplibre/maplibre-gl-leaflet, and @types/leaflet

## Local verification
- Run from apps/web: `bun test test` — 135 pass, 0 fail (2026-11-19).
- API validation: `bun test apps/api/test/meetup-location.test.ts` from the repo root — 4 pass, 0 fail.
- `bunx tsc -p apps/web --noEmit` and `bunx tsc -p apps/api --noEmit` passed.
- `bun --filter @cpsu/web build` succeeded. The lazy map bundle exceeds Vite's 500KB chunk warning threshold; it is not downloaded during ordinary browsing.

## Browser acceptance still needed
1. Sign in as two independently verified students; create/accept a purchase or service request.
2. Choose a public location on a 390px mobile viewport and on desktop, enter a day/time, save, refresh, and sign in as the second participant to verify visibility.
3. Confirm the meetup from one account; verify the old handoff endpoint rejects changes, and the new location endpoint requires explicit resetConfirmations approval. Saving a revision must return the transaction to negotiating and clear both confirmations.
4. Confirm from the second account and verify transaction status; cancel, completion, and chat history remain unchanged.
5. Check touch panning, keyboard center-pin control, map attribution, raster fallback without WebGL, and offline text/link fallback on Android/iPhone Safari.
6. Exercise production-like tile traffic and review OpenFreeMap and OpenStreetMap tile policies.

No local development database records were modified and no migration was applied by this change.
