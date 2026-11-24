# shadcn/ui setup (17 November 2026)

The existing `apps/web` Vite app now has Tailwind CSS v4 and the official shadcn CLI configuration in `apps/web/components.json`. The official Button component lives in `apps/web/src/components/ui/button.tsx`; shared component utilities live in `apps/web/src/lib/utils.ts`. Add future components from the repository root with `bunx shadcn add <component> -c apps/web` or from `apps/web` with `bunx shadcn add <component>`.

`apps/web/src/shadcn.css` loads Tailwind's theme and utilities without Preflight and maps shadcn's semantic colors to the approved white and forest-green CPSU palette. It is imported before the existing storefront styles. The project remains light-only and keeps its current Inter and Plus Jakarta Sans typography. Existing screens were not converted to shadcn components.

The app uses the standard `@/*` alias in Vite and TypeScript. `package-lock.json` and `bun.lock` were refreshed. This is a web dependency change only; there are no database changes or new marketplace features.

References: https://ui.shadcn.com/docs/installation/vite and https://tailwindcss.com/docs/preflight.
