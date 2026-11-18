# CPSU Market — Row-Level Access Hardening (2026-11-18)

## Database compatibility
The application uses Prisma's `mysql` provider against MariaDB 10.11.
MariaDB does not offer native PostgreSQL `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`.
This work adds query-time server-side authorization, **not database-enforced RLS**.
Any code accessing the unrestricted Prisma client can bypass these helpers.
Never describe this as native RLS or as a complete database isolation boundary.

## Implementation
- Added `apps/api/src/row-access.ts` with centralized, typed Prisma predicates.
- Private owner-scoped lookup: seller listing records; account notifications and saved listings.
- Participant-scoped lookup: inquiry threads and transactions; inaccessible IDs return 404.
- Public listing and media lookups: public/owner/authorized campus reviewer query scope.
- Campus review lookup: listing decisions/suspensions and affiliation verification.
- Reviewer transaction dashboard uses campus row predicate.
- Existing authentication and additional in-handler permission gates remain intact.

## Row visibility matrix
| Resource | Student | Campus reviewer | Global university admin | Guest |
| --- | --- | --- | --- | --- |
| Own seller listings | Own only | Campus review scope | Review scope | Published only |
| Inquiry threads | Buyer or store owner | No access | No access | No access |
| Transactions | Buyer or seller | Campus status-only admin summary | Status-only admin summary | No access |
| Notifications, saves | Own only | Own notifications where applicable | Own notifications where applicable | No access |
| Listing photos | Published or own | Campus review scope | All review scope | Published only |
| Affiliation review | None | Assigned campuses | All campuses | None |

## Verification
- `bun test test/row-access.test.ts test/permissions.test.ts test/store-follows-http.test.ts test/store-followers-private.test.ts test/listing-cover-http.test.ts test/report-http.test.ts test/public-avatar-compat.test.ts`: **38 passing, 0 failing** (synthetic unit/HTTP tests).
- `bunx tsc -p . --noEmit`: **pass**.
- No database schema change, migration, SQL write, deployment, commit, or push was made.

## Not yet release acceptance
- A full endpoint-by-endpoint authorization audit for all private ORM queries and update paths.
- Authenticated cross-account/cross-campus HTTP negative tests in an isolated test database.
- Race-condition testing for changes to account status, ownership, and reviewer assignments.
- Independent database-layer policies would require a separately planned and approved PostgreSQL migration, or a carefully maintained MariaDB view/privilege model.
- The application database account and raw SQL usage need least-privilege review. These typed predicates alone cannot prevent bugs or bypass through other code paths.
