# CPSU Market — Mobile Guest Header Alignment
Date: November 17, 2026

## Finding
At a 320px viewport, the full 'CPSU Student Marketplace' brand occupied a narrow, wrapped area beside the Sign in / Create account controls. The large registration CTA dominated the horizontal header and reduced breathing space at screenshot-sized phone widths.

## Scoped adjustment
- `apps/web/src/main.tsx`: Preserve `/register`, add a targeted guest-header class, display compact **Sign up** on phones and the existing **Create account** label on wider screens; retain the accessible name 'Create account'.
- `apps/web/src/mobile-refinements.css`: At <=560px, use a compact registration label and consistent 44px button height. At <=350px, use a deliberate two-row guest header: brand first, equal-width Sign in and Sign up controls second. Signed-in, reviewer, route, and desktop experiences remain unchanged.

## Verification
- Real local Vite homepage inspected in Chromium at 320, 360, 375, 390, 420 and 768px; no document-level horizontal overflow at these widths. Target controls remain at least 44px high. At 320px with 200% root font size, the header stayed inside the viewport without horizontal overflow.
- Clicked the mobile Sign up button; navigation succeeded to `/register` and showed the 'Create your account' heading.
- Impeccable source detector for touched files returned `[]`. `bun test`: 71 passing, 0 failing. `bun run build`: TypeScript/Vite success.
- Physical iPhone Safari, Android Chrome and screen reader testing not yet performed. No migration, deployment or Git push was performed.
