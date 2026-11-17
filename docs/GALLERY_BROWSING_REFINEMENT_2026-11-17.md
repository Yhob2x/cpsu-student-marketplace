# Gallery browsing refinement — 17 November 2026

The listing detail gallery now keeps its selected thumbnail visible as students swipe. The full-screen viewer shows the listing title and a compact photo strip for direct navigation. Selecting another photo while zoomed resets zoom for the new image. Closing the viewer returns the detail gallery to the photo last viewed.

The viewer opens with a short opacity transition; selected thumbnail borders change over 160 ms. Reduced-motion preference shortens both. Native gallery scroll and existing pinch, double-tap, drag, keyboard, focus, empty, and failed-image behavior remain in place. No API, database, authorization, media storage, or upload limit changed.

Verification: web TypeScript check, production Vite build using `--configLoader runner`, 10 focused unit tests, and the synthetic Chrome gallery fixture (17 checks passed at two window-size settings). The synthetic fixture uses pointer events and is not a physical touch-device test. Manual iPhone Safari and Android Chrome acceptance remains required for actual pinch and swipe feel.
