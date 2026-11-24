# CPSU Market — Multiple-photo product gallery usability

Date: 2026-11-16 (Asia/Manila)

## Owner request
The owner reported that product listing photos could not be swiped on phones and asked for a more useful multi-photo presentation. Keep the existing five-photo upload limit, published-only visibility, privacy controls and approved light/forest-green visual theme.

## Implementation
- Listing cards retain a single cover photo; a discreet factual badge shows the photo count when a product has multiple photos. Tapping a listing leads to its detail page.
- Detail page uses one full-width slide per photo in a native horizontally scrollable CSS scroll-snap viewport, allowing finger swipes on phones without hijacking vertical page scrolling.
- Add previous/next buttons with disabled boundary states, live photo counter, a short swipe hint, and tappable thumbnails that reflect the visible slide.
- The gallery viewport supports ArrowLeft/ArrowRight and Home/End for keyboard navigation, visible focus, and accessible photo labels; animations honor reduced-motion preferences.
- The existing save button remains separate and accessible above the gallery. Failed images show an explicit fallback rather than a broken placeholder.
- Photo bytes are still loaded only through the existing authorized marketplace /api/v1/media/:id endpoint. No direct Drive URLs, database writes, storage migration, or permission changes.

## Verification
Run from apps/web:

```powershell
bun run build
bun test test/gallery-navigation.test.mjs test/home-listings.test.mjs test/listing-photo-uploads.test.mjs
```

## Zoom and swipe continuation — November 17, 2026

The product gallery offers a full-screen photo viewer with pinch-to-zoom (up to 4×), double-tap zoom, mouse dragging, zoom buttons, reset, previous/next photo controls, and an Escape/Close action. The image viewer uses its own scroll/gesture surface rather than swiping the listing details or the Explore grid. Mobile Explore retains its two-row horizontal-column browsing behavior outside the photo viewer. No API, database, authorization, or Drive settings changed.

The moved, isolated synthetic browser smoke fixture is now usable again from `apps/web/test/fixtures/gallery-zoom.html`. To reproduce safely from `apps/web`, run the following in **two separate terminals**:

```powershell
bun run dev --host 127.0.0.1 --port 5198 --strictPort
```

```powershell
bun test/gallery-zoom-browser-smoke.ts
```

The browser harness requires a local Chrome browser and uses a disposable Chrome profile. On November 17, 2026: **13/13 headless Chrome checks passed** at a 390×844 viewport, including simulated two-pointer pinch, zoom-image drag, double tap, counter/thumb synchronization, and Escape closing with body-scroll restoration; the web TypeScript/Vite build passed and 11 focused web unit tests passed. Browser-simulated pointer events are not a substitute for real touch hardware.

Manual acceptance is still required on iPhone Safari and Android Chrome with a published listing containing at least three photos: swipe left and right; check counter and thumbnail selection; open the zoom viewer; pinch with two fingers; double-tap; drag while zoomed; close the overlay and verify normal vertical scrolling resumes. A physical-device check has **not** been claimed until performed.
