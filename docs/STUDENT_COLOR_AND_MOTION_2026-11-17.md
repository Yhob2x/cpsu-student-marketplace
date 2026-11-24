# CPSU Market — Student-side color and motion refinement

Date: November 17, 2026 (Asia/Manila)

## User intent
Keep the approved light / forest-green identity while adding more visual "pop" to the student marketplace. Follow installed UI UX Pro Max and Emil Kowalski-inspired design engineering skills. Preserve existing brand, categories, photos, navigation, all workflows, and privacy constraints.

## Inspected references
- `MASTER_BLUEPRINT.md`, `AGENTS.md`, `docs/UI_UX_GUIDELINES.md`
- Installed `.agents/skills/ui-ux-pro-max/SKILL.md` and `.agents/skills/emil-design-eng/SKILL.md`
- UI UX Pro Max local color and accessibility searches, and React guidance. Market purple results were deliberately rejected because they conflict with the approved CPSU forest-green brand. Education/amber guidance informed accent roles, not a brand replacement.
- Existing tokens and overrides in `styles.css`, `storefront-theme.css`, `mobile-refinements.css`, and `student-emphasis.css`; relevant React markup in `pages-public.tsx`.

## Visual direction
- **Forest `#073B2A`:** text, navigation labels, primary functional hierarchy.
- **White `#FFFFFF`:** default product cards, search/results and application surfaces.
- **Warm cream `#FBF7EB`:** homepage hero only, as a calmer editorial stage.
- **Warm gold `#E0BB46`:** existing primary Explore CTA plus the selected mobile listing-type tab and enabled Send inquiry action. It is not spread across every price, card or status.
- **Pale gold `#FFF0C8`:** active app tab and open mobile filter disclosure; the text remains forest green.
- **Muted mint / gray-green:** unchanged secondary layers, cards, ordinary controls, status semantics.
- Focus remains a visible forest outline on gold/warm backgrounds; selected states also include labels and `aria-pressed`/`aria-current`, so color is not the only signal.

## Emil-inspired movement
- **Why:** acknowledging primary taps and selection, not simply making the page animate.
- Approx. 140–150 ms button feedback using custom deceleration easing, with touch press `scale(.975)`.
- Transitions only on transform and colors / shadows; no height/width animation and no extra page-entry choreography.
- Disabled buttons keep disabled behavior; `prefers-reduced-motion: reduce` turns the new effects off.
- Content structure, image swiping and zoom interactions are untouched.

## Files changed
- `apps/web/src/student-emphasis.css` (targeted CSS extension; existing import already in `main.tsx`).
- This design note. No APIs, migrations, accounts, Google Drive or student content changed.

## Validation
- Chrome device emulation on Home and Explore at 360, 390, 768, and 1280 CSS px.
- All tested widths had `documentElement.scrollWidth === viewport width`.
- Hero computed background `rgb(251, 247, 235)`.
- Homepage gold action and mobile selected Explore filter computed `rgb(224, 187, 70)` with forest text and ~6.81:1 contrast, above WCAG AA normal-text contrast target.
- Active navigation uses pale gold background on phone/tablet widths.
- A simulated reduced-motion preference returned `0s` transition durations for Explore selection.
- `bun run build` and targeted unit tests; automated color validation covers computed styling, not human perception.

## Release gates
- Manual iPhone Safari / Android Chrome testing of keyboard focus, hover/press states, actual thumb reach, button visibility, and dynamic text sizes. Browser emulation is not a substitute for physical devices.
- Do not infer that other unfinished workflows are release-ready from this color-only pass.
