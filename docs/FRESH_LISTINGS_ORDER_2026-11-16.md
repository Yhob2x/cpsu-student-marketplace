# Fresh listings ordering — 16 November 2026

The Home page previously used the newest feed as a fallback for an empty Popular rail, then removed those same listings from Fresh. With eight or fewer available listings and no saves, Fresh could disappear entirely. A newly added listing could therefore be absent from the section even though the public API returned it first.

Fresh now always takes the eight most recently approved public listings. Popular shows only the most-saved results when they exist; a listing may appear in both rails because the labels describe independent views. Student services still avoids duplicates already shown above. The Home feed uses the latest approved review time, falling back to creation time for legacy published listings without a review. Descending ID breaks equal-time ties. Explore's `newest` sort remains based on creation time; price sorts also use ID as a tie breaker.

Only published, available listings from approved, active sellers are returned by the public API. Uploading a draft or adding a photo to a published listing does not bypass campus review. A reapproved listing returns to Fresh according to its latest approval; availability or other edits without approval do not move it forward. A new draft made with Sell again becomes eligible after its own approval.

No database migration or moderation-rule change. Regression coverage: `node --test apps/web/test/home-listings.test.mjs`.
