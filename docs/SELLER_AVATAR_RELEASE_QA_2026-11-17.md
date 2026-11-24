# CPSU Market — Seller-avatar content safety release QA

**Date:** November 17, 2026 (Asia/Manila)
**Scope:** Local, no deployment. Seller/store profile pictures only (listing photos keep their existing review process).

## Verified implementation
- Authenticated seller-only upload: file format, size and pixel verification; 512×512 WebP conversion; strip original metadata; local NSFWJS/TensorFlow.js classifier before Google Drive storage and before database publication; model failures and uncertain/explicit results fail closed; previous photo is preserved.
- Screenshots, real student photos and private Google Drive IDs were not used in this QA.
- Existing QA acceptance: authenticated API upload, replacement, public retrieval, removal, audit creation, unauthorized access, generated safe images; simulated explicit/uncertain/unavailable errors all blocked and cleaned.

## Browser UI validation
A local headless Chromium browser loaded the **actual React `SellerAvatarEditor` component** from a temporary local Vite server. An in-browser fake API provided synthetic store data and simulated upload outcomes (all unexpected API requests returned an error). The test did not call live student APIs or Google Drive.

- **320px, 360px and 390px layout constraints:** **17/17 checks passed at each size; 51 assertions total.** Tested file-picker containment, no horizontal overflow, currently displayed and selected preview, enabled submit after file selection, explicit rejection message and preserved photo, uncertain rejection and recovery, busy message, disabled submit and `aria-busy`, successful upload feedback, preview cleanup, and seller removal.
- Scripts: `apps/web/test/fixtures/seller-avatar-mobile-qa.html`, `apps/web/test/seller-avatar-mobile-browser-smoke.ts`.
- Requires temporary localhost Vite on `127.0.0.1:5198`, then `bun test/seller-avatar-mobile-browser-smoke.ts --synthetic-browser-only` from `apps/web`.
- This checks a narrow-body, mobile-style viewport in desktop headless Chrome. It **does not replace physical iPhone Safari, Android Chrome, keyboard, touch, camera access or safe-area testing**.

## Offline classifier evaluation harness
Added `apps/api/scripts/seller-avatar-consented-evaluation.ts` as a future accuracy-testing utility:
- Runs **only after an explicit CLI flag**, with an absolute, separately authorized local image corpus outside the repository and temporary directories; rejects invalid/missing images, unsafe filenames, unexpected labels and malformed manifest entries.
- Requires `manifest.json` in that corpus with `purpose: "consented-local-safety-evaluation"` and 1–100 items labeled `allowed` or `prohibited`.
- Reproduces the normalized 512×512 WebP crop, runs the same classifier, and returns **only aggregate** outcomes for each label: safe publication, explicit rejection, uncertain hold, technical failure.
- No corpus file paths, image bytes, per-file labels or names are logged. Local sanitized copies are deleted after each scan; the source corpus remains untouched. No images are sent to Google Drive or an external classification service.
- **Safe-only harness smoke: PASS**, tested using three generated, harmless images created in a temporary private local corpus outside the repository. All three classified safe. Source test corpus was removed after validation.
- This smoke test has **zero prohibited examples** and therefore **cannot establish sensitivity, false-negative rate or go-live clearance**. An authorized representative prohibited corpus is still required.

Example only, to be run later with a lawful, authorized local dataset:

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace\apps\api
bun scripts/seller-avatar-consented-evaluation.ts --evaluate-consented-local-images "C:\PrivateAuthorizedAvatarEvaluation"
```

A corresponding manifest in that folder:
```json
{"purpose":"consented-local-safety-evaluation","items":[
  {"filename":"approved-example.png","label":"allowed"},
  {"filename":"prohibited-example.png","label":"prohibited"}
]}
```

The example names indicate labels only; **no prohibited sample or private data is bundled with the project**. An authorized evaluator must source, label and secure those files independently.

## Existing local CPU benchmark
Eight generated, non-sensitive images were evaluated on the Windows development PC. All eight were classified safe. Mean 816 ms, first warm-up 1,258 ms, and approximate process RSS increase 145 MiB. This is **not** a VPS resource guarantee, a concurrent-throughput benchmark or a prohibited-image accuracy result.

## Remaining release gates
1. Obtain approved, privacy-safe dataset with allowed and prohibited examples. Evaluate false positives, false negatives and uncertain holds. Document policy threshold decisions and incident response.
2. Test on a real iPhone Safari and Android Chrome: gallery selection, camera permission where relevant, rejection messages, progress, replacement, public refresh and accessibility, with synthetic accounts.
3. Benchmark cold start, memory, throughput, queue exhaustion, timeout and error handling on the planned VPS configuration.
4. Verify reporting and administrator image takedown paths, backup/restore of private media, log privacy and incident response.
5. Only then approve staging/production rollout. Do not assume a local passing unit test is proof of content-safety accuracy.

**Data/release scope:** No CPSU development schema changes, real student data writes, network deployment, Git commit or push were performed in this QA.
