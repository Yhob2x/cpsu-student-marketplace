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

Manual acceptance required on iPhone Safari and Android Chrome with a published listing containing at least three photos: swipe left and right; check photo counter and thumbnail selection; use arrows; try keyboard navigation on desktop; confirm the page still scrolls vertically and the Save control works. A physical-device check has **not** been claimed until performed.
