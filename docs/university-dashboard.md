# University dashboard development data

Run the opt-in seeder against a migrated local or disposable test database.

```sh
php artisan db:seed --class=UniversityDashboardDemoSeeder
```

Sign in with `admin@dashboard-demo.example` and `DashboardDemo!2026` and open the University dashboard. This synthetic account is only for local testing.

On an empty database, the fixture adds ten configured campuses. Demo Riverside and Demo Cedar have five storefronts between them, 25 publicly discoverable listings, and 18 orders across all six transaction statuses. Eight other campuses have no marketplace activity. Start with the 30-day range to see a daily trend point with five completed orders, two campus rows, and both visible and suppressed sales amounts. Five older completions populate the previous 30-day comparison.

The seed commits once and preserves existing data. A rerun leaves the fixture, any edits, and its original dates in place. Use a fresh disposable database for a new set of recent dates.

The dashboard uses the enabled campus roster. When one to four orders were cancelled, the cancellation rate is omitted to prevent the rate from revealing the suppressed count. Rows with suppressed live-listing counts share the same sort rank.

Masking applies to each response field. Exact totals and overlapping breakdowns can still allow someone to infer a suppressed value by subtraction.

## Index candidates

Compare query plans with `EXPLAIN` on a representative staging database before adding indexes. The baseline already indexes storefront owners, listing campuses and categories, and transaction lookups by buyer, seller, listing, and thread.

| University dashboard query | Candidate index columns in order |
| --- | --- |
| New orders by date and campus | `Transaction (createdAt, listingId)` |
| Current orders by status | `Transaction (status)` |
| Terminal events in a date range | `TransactionStatusLog (toStatus, createdAt, transactionId)` |
| Check for an earlier terminal event on the same order | `TransactionStatusLog (transactionId, toStatus, createdAt)` |
| Inquiries opened in a date range | `InquiryThread (createdAt)` |
| Distinct listing approvals over time | `ListingReview (decision, createdAt, listingId)` |
| Distinct verified students over time | `Affiliation (verificationStatus, verifiedAt, userId)` |
| Live listings by campus and category | `Listing (status, availabilityState, deletedAt, sellerProfileId, campusId, categoryId)` |
| Eligible storefronts by campus | `SellerProfile (approvalStatus, sellerType, campusId, ownerUserId)` |
