# Public store name URLs — 2026-11-18

The owner requested `/store/nameofstore` instead of `/stores/3`. The canonical address is derived from the current approved store name. Spaces, punctuation and accents are normalized; non-Latin letters remain valid URL text. If names collide, the earliest store keeps the plain slug and later stores use `--<id>`. Empty or punctuation-only names use `store--<id>`.

The public API resolves only approved stores whose owner is active. It returns the canonical slug with the existing store details. The browser accepts direct `/store/:slug` loads and changes legacy `/stores/:id` visits to the canonical address. Numeric IDs still identify the store for follows, messaging, reporting and all existing authorization checks. Sign-in return validation accepts only well-formed store slug paths.

No schema, migration, PWA worker, navigation action, or database row changed. A later store rename changes its canonical name URL; historical name aliases are not stored. The old numeric URL remains a durable fallback. Existing links inside the app can still use that numeric fallback and settle on the new address after loading.

Follow-up: two approved stores are named Yobyob. Store 1 now uses `/store/yobyob`; its former `/store/yobyob--1` link continues to resolve and redirects to the plain address. Store 2 uses `/store/yobyob--2`. The local API reports one follower for store 1, and Chrome rendered that count on its public page. Follower identities remain visible only to the store owner from My Store, as required by the existing privacy rule.

Verification: focused slug and sign-in return tests pass; API TypeScript and web production build pass; the complete API unit suite passes (168 pass, 8 guarded skips). Local HTTP resolved `/api/v1/seller-profiles/by-slug/kalabasa` to store 3 and returned 404 for an unknown slug. The complete web suite has one unrelated missing-module failure in `test/listing-quality.test.ts`; the file imports absent `src/listing-quality.ts` in the current workspace.
