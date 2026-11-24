# Frontend structure

The React TypeScript app lives in `resources/js` and follows the layout of Laravel's official React starter kit. Every import inside the app uses the `@/` alias (`@/components/icons`), except imports from the same folder (`./status-pill`).

| Folder or file | Holds | Rule |
|---|---|---|
| `app.tsx` | Vite entry | Loads the stylesheets, then renders the router, session provider and layout. Nothing else. |
| `styles.ts` | Every stylesheet of the main bundle | Order is the cascade order. Add new files at the end and never reorder. |
| `routes.tsx` | URL table and route guards | One `<Route>` per line. Access rules live in the guard components, not in pages. |
| `layouts/` | Page chrome | Header, navigation, footer, overlays and the page outlet. |
| `pages/` | One routed screen per file | Only components that a route renders. Folders follow the URL with `index` and `show` names, for example `pages/transactions/show.tsx` for `/transactions/:id`. |
| `components/` | Reusable UI, grouped by feature | `listings`, `stores`, `chat`, `meetup`, `transactions`, `account`, `admin`, `layout`, and `ui` for shared primitives. Admin tabs and the storefront view are components because no route renders them directly. |
| `providers/` | React context providers | `session-provider.tsx` owns the signed-in account, unread counts, saved listings and sign-out. Read it with `useMe()`. |
| `hooks/` | Reusable hooks | Files are named `use-*.ts`. |
| `lib/` | Logic without UI, grouped by domain | API client, formatting, filters and validation rules. Pure functions here are unit-tested directly. |
| `types/` | Types shared by several folders | Types used by one file stay in that file. |

## Pages

| URL | Page |
|---|---|
| `/` | `pages/home.tsx` |
| `/explore` | `pages/explore.tsx` |
| `/listings/:id` | `pages/listings/show.tsx` |
| `/store/:slug`, `/stores/:id` | `pages/stores/show.tsx` |
| `/guidelines` | `pages/guidelines.tsx` |
| `/login` | `pages/auth/login.tsx` |
| `/dashboard` | `pages/dashboard.tsx` |
| `/inquiries`, `/inquiries/:id` | `pages/inquiries/index.tsx`, `pages/inquiries/show.tsx` |
| `/saved` | `pages/saved.tsx` |
| `/transactions`, `/transactions/:id` | `pages/transactions/index.tsx`, `pages/transactions/show.tsx` |
| `/profile` | `pages/profile.tsx` |
| `/notifications` | `pages/notifications.tsx` |
| `/admin` | `pages/admin/index.tsx` |
| anything else | `pages/not-found.tsx` |

`pages/auth/register.tsx` is not routed: `/register` redirects to `/login`. It is kept until the project owner decides whether registration gets its own page.

## Tests

- Unit tests are in `tests/frontend` and import modules by relative path.
- Tests that check source text use `tests/frontend/support/source-files.ts`. `PAGE_GROUPS` lists the files that replaced each former multi-page module, so the same assertions cover the same code.
- Browser tests are in `tests/e2e`.
