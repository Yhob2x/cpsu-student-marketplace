# CPSU Market — UI/UX hierarchy audit
**Date:** 17 November 2026 (Asia/Manila)  
**Mode:** Read-only product hierarchy audit (no application, API, database, migrations, deployment or configuration changes).

## Method and verification
- Guidance: installed UI UX Pro Max hierarchy/navigation/accessibility rules and Impeccable audit.
- Inspected actual source: `apps/web/src/main.tsx`, `pages-public.tsx`, `pages-profile.tsx`, `profile-refinements.css`, `pages-account.tsx`, `pages-admin.tsx`, `pages-reviewers.tsx`, `pages-transactions.tsx`, `floating-chat.css`.
- Live guest browser inspection on local Vite app `127.0.0.1:5173`: Home, Explore, Store, Listing Detail and Registration, at 390px mobile and/or 1280px desktop; Home also at 320px. This is **not** physical device testing.
- The 320px Home document measured `scrollWidth=320`, with no document-wide horizontal overflow.
- Impeccable source detector on `apps/web/src`: `[]` (no source findings). This does not certify usability, keyboard, screen reader, WCAG, or physical devices.
- Screenshots for visual review: `.tmp/hierarchy-home-mobile.png`, `hierarchy-explore-mobile.png`, `hierarchy-store-mobile.png`, `hierarchy-register-mobile.png`, `hierarchy-detail-mobile.png`, `hierarchy-home-320.png`, and desktop variants in `.tmp`.
- Authenticated Profile, seller dashboard and admin/reviewer workflows were **source-reviewed only** (not rendered using a verified student/staff session). No account or data was changed.

## Overall assessment
The visual language is coherent (forest green, gold, white), mobile primary navigation and homepage browsing order are understandable, and basic headings are structured. The remaining hierarchy problems are not generic styling defects: they concern what the interface chooses to show first, how it competes for attention, and where fixed UI obscures task content.

## Prioritized findings

| Priority | Surface | Observed evidence | Recommended response |
|---|---|---|---|
| **P1** | Register mobile | Disabled Full name and Student ID fields appear before working Email, Password and Campus. They look nearly as available as the other controls; a lengthy privacy message separates them from actual registration. At 390px, required fields and Create account are below the first viewport. | When collection is inactive, replace the disabled controls with a concise, plainly labeled **Not collected yet** information row after the working form. Keep identity collection disabled pending CPSU policy approval; never silently enable it. Keep active-required fields in the form when policy is actually active. |
| **P1** | Floating Chat sitewide | The fixed gold Chat launcher overlaps product card content on Home/Explore and reading content in Listing Detail at 320–390px, and covers the Store browsing heading region. It is positioned above the tabbar but occupies the content plane. | Preserve floating chat functionality but minimize its resting footprint (compact icon with accessible label), permit dismissal or contextual hiding on critical controls, and ensure cards/actions/reading text can scroll fully clear. Validate with iPhone safe-area + keyboard. |
| **P1** | Store mobile | Hero gives three competing actions (Follow, Chat with seller, Browse listings) before store stats; category tabs/chips appear next, with the first listing below the fold. | Make **Browse listings** the clear primary task, keep Follow as visible secondary, position Chat contextually; compact the stats/hero and surface product previews earlier without removing functionality. |
| **P2** | Explore desktop | Header search and Explore's search both appear; the default six-field filter panel takes substantial first-viewport space, so only tops of listing cards are visible at 1280x800. Mobile compact filters are clearer. | Keep search obvious, show the top 2–3 constraints first, reduce filter panel height or progressively disclose uncommon filters; prioritize actual listings within the first viewport. Preserve URL-backed filters. |
| **P2** | Global desktop navigation | `All listings` and `Explore` link to the same route; primary nav exposes Home, Explore, Sell, Transactions, Profile, Guidelines even to guests, alongside header search and account actions. | Remove redundant primary destination, demote Guidelines to help/footer, group authenticated activity when appropriate, and ensure guest-only routes explain sign-in clearly. |
| **P2** | Home categories | Mobile shows short ambiguous names such as `Made`, `Used`, `Print`, and `Photo`; desktop shows both long and short versions in one small tile. Accessible names are present but sighted scanning is weak. | Use concise **descriptive** labels (e.g. Handmade, Pre-loved, Printing, Photography) with wrapping where needed; show one visible name per category, keeping one-row desktop and responsive mobile grid. |
| **P2** | Profile source | The desktop grid matches the requested pairs and full-width Store profile; internal Store details and picture cards use equal desktop tracks. However, registration repeats inactive CISS placeholders for four fields, while PWA install card sits in the upper heading row, competing with identity/status. | Keep the owner's top-right PWA placement on desktop, compress it on mobile, and collapse repeated future CISS information to one clearly informational block. Keep live affiliation and editable fields more prominent. |
| **P2** | Mobile 320px header | Sign in and Sign up use two rows in the screenshot, adding height before discovery. | Compress brand/account layout at <=359px without removing text equivalents or reducing touch targets. |
| **P2 (unverified live)** | Admin mobile | Source uses a single optgroup select for every workspace section. Role-specific grouping and landing tasks are sound, but urgent queue counts live inside options rather than always-visible controls. | For reviewers, expose compact at-a-glance counts and a visible next-review entry while retaining the existing mobile selector for deeper management. Test using authorized synthetic reviewer/staff accounts before classifying as a verified UX defect. |
| **P3** | Desktop Home hero | Decorative image blocks occupy the right side without much supporting real discovery content; two search entry points exist (header and hero). | Prefer meaningful approved campus/listing imagery, or simplify decoration. Avoid inventing suppliers or testimonials. |

## Verified strengths
- Home reading order: hero/search → categories → Fresh/Popular/Services → Most followed stores → supporting content. The sections are meaningfully grouped rather than scattered.
- Mobile Explore: search, All/Products/Services, More filters, result count and sort appear before cards; all are discoverable.
- Store: clear store identity, campus and verified-community label, real listing/follower counts, product/service scope filters.
- Listing detail: back link, photo, title, price, metadata and seller attribution are in a coherent reading sequence.
- Basic source heading order and skip-to-content exist. Source detector returned no findings.

## Recommended final information architecture
**Guests:** Home → Explore → Listing detail → Store → Sign in/Create account when an action needs identity.  
**Buyers:** Explore/Saved → Listing/Store → Chat/Requests → Transactions; profile and notifications secondary.  
**Sellers:** My store → Create listing → Listing status/management → Store profile; buyer activity remains reachable.  
**Campus reviewers:** Review queue first → Listing reviews → Verifications → Reports → Transactions/overview.  
**University admins:** Overview first → Student/Reviewer/Content management → Review & safety → Monitoring/Audit.

## Implementation order (separate change, not performed in this audit)
1. Fix registration priority without changing the identity-data approval gate.
2. Fix Chat overlay occlusion while preserving its floating behavior.
3. Simplify Store mobile hero/action hierarchy.
4. Compact Explore desktop filters and deduplicate desktop primary navigation.
5. Clarify category labels and 320px header; demote future CISS placeholders in Profile.
6. Perform authenticated source-to-browser acceptance for Profile, My Store, Notifications, Transactions, reviewer and admin at 320/390/768/1280px, with keyboard, VoiceOver/TalkBack, 200% text, reduced motion and real-device testing.

**No UI changes, migrations, API calls that mutate records, deployments, commits or pushes were part of this audit.**
