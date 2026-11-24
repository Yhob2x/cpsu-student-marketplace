# CPSU Market — Floating mobile Messages and search control
Date: 2026-11-17 (Asia/Manila).

## Authorized change
The previous mobile decision to place Messages inside the bottom navigation was reversed at the owner's request.

- On widths up to 860px, a **54px floating gold chat icon** now sits just above the **four-item** Home / Explore / Sell / Profile bar. Existing unread badge, sign-in gating, and authenticated inbox/thread behavior remain. The panel opens **above** the launcher. The launcher hides while an input or on-screen keyboard is active; prefers-reduced-motion and existing escape/close behavior remain in effect.
- The Home hero's **Search** submit button shows a **magnifier icon only** on mobile; the input stays visible, and the button keeps the accessible name `Search listings`. Desktop retains the visible Search text.
- No backend, identity policy, database, service worker, or push changes were authorized or made as part of this request.

## Files edited
- `apps/web/src/hierarchy-polish.css` — remove five-item mobile Chat integration, restore compact fixed launcher/panel position, mobile search button style.
- `apps/web/src/pages-public.tsx` — real Search action retains accessible name with icon/text presentation.

## Validation
- `cd apps/web && bun run build`: PASS (TypeScript, Vite build).
- `cd apps/web && bun test`: 73 PASS, 0 FAIL.
- Local Chrome visual: screenshots `.tmp/chat-restored-home-320.png`, `.tmp/chat-restored-home-390.png`, `.tmp/chat-restored-store-320.png`.
- Browser interaction with **synthetic intercepted** auth + inbox responses, **not** a real account: 320, 390 and 768px all had exactly 4 mobile nav items, a 54px launcher fully above the tabbar, no document overflow, working open/Escape-close, panel within the viewport. At 1280px the existing desktop floating launcher/panel remained. Input focus hid the launcher; input search `kalabasa` navigated to `/explore?q=kalabasa`.
- Desktop and phone physical-device validation (real Safari/Chrome, keyboard, safe-area, screen-reader) remains pending.

No deployments, commits, pushes or migrations. Other uncommitted project changes were retained.
