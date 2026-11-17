# CPSU Market — Local server-side NSFW screening for seller avatars

**Date:** November 17, 2026 (Asia/Manila)
**Status:** Implemented in local source; real-model and isolated authenticated HTTP acceptance passed. Controlled sensitive-image accuracy evaluation and production/mobile deployment acceptance remain pending.

## Owner-approved behavior
Sellers explicitly select and upload their own store profile photo. Valid pictures are normalized to a square, metadata-free WebP, then classified on the CPSU API server with NSFWJS **MobileNetV2** running on TensorFlow.js **CPU**. No picture is sent to a third-party moderation endpoint. Classification happens **before** persistent storage in the active media adapter (including Google Drive) and before the seller-avatar database write. Only confidently safe pictures publish automatically, with no campus-review queue.

- **Safe:** Publish immediately after successful storage and atomic database/audit update.
- **Explicit:** Reject with HTTP 422 and the user-facing `avatar_explicit_content` message.
- **Uncertain:** Reject with HTTP 422 and `avatar_uncertain_content`; the seller may choose another image. No image is queued for human review, consistent with the owner's earlier refusal of avatar-review workflows.
- **Classifier/model unavailable, invalid result or runtime problem:** HTTP 503 `avatar_screening_unavailable`; fail closed. The old public profile photo remains in place.

The original upload is deleted after file validation and re-encoding. The newly sanitized temporary picture is also removed after a screening/storage/database failure; cleanup errors are logged. Rejected images are not intentionally transferred to Google Drive or used to change database avatar references.

## Decision and limitations
The classifier predicts Neutral, Drawing, Sexy, Porn and Hentai. The initial **conservative, uncalibrated policy**:
- Block explicit when `Porn + Hentai >= 0.60`.
- Classify as uncertain when `Porn + Hentai >= 0.12`, or `Sexy >= 0.35`, or `Neutral + Drawing < 0.65`.
- Otherwise allow. Missing/invalid/unexpected model outputs are uncertain.

These thresholds are provisional. Model predictions are error-prone; both false positives and false negatives are possible. Do not claim that every explicit, harmful, or misleading image will be caught. Before any public launch, evaluate a privacy-safe, authorized set of representative allowed/disallowed test images, tune thresholds with campus policy and DPO guidance, and retain user reporting plus administrator response processes. The model does not handle all image safety concerns (violence, impersonation, academic misconduct, etc.).

## Resources and runtime
- Uses `nsfwjs@4.4.0` with `@tensorflow/tfjs@4.22.0`. The default MobileNetV2 model is bundled in the dependency; no keyed API, fee, outbound inference request or separate model download on each upload.
- Reuses `sharp` for local decoding and resizes model input to RGB 224×224.
- Lazily loads one shared model; inference tasks are serialized and the waiting queue is limited to four uploads. If model startup fails, the next attempt may retry initialization. Invalid classification probability distributions fail closed.
- Limits seller-avatar uploads to **10 per authenticated account per 15 minutes**.
- In production builds `sharp` and `argon2` stay external to the Bun JavaScript bundle because they include native modules; install the project's dependencies on the server's target OS with Bun. Never copy Windows-native modules onto Linux.
- Server builds increase in size because model weights are bundled; a 43.59 MB built server was observed locally. Benchmark inference throughput and memory on the intended VPS before deployment.

## Files
- New `apps/api/src/seller-avatar-screening.ts`: local classifier, bounded queue, explicit/uncertain policy and fail-closed behavior.
- Updated `apps/api/src/routes/seller.ts`: scan after normalization but before Google Drive storage or DB publication; cleanup and seller-specific rate limit.
- Updated `apps/web/src/api.ts` and `apps/web/src/seller-avatar-editor.tsx`: understandable safety feedback and photo-policy text.
- `apps/api/package.json` and root `bun.lock`: add NSFWJS and TensorFlow.js, keep native addons external for Bun build.
- New `apps/api/test/seller-avatar-screening.test.ts`: synthetic score thresholds, malformed classifier output.
- New `apps/api/test/seller-avatar-screening-model-smoke.ts`: real model inference on a generated safe picture, no DB or Google Drive.
- `MASTER_BLUEPRINT.md`: authorized scope change recorded.

## Validation
- Real model initialization and inference on generated, non-sensitive image: **PASS**, safe prediction; no private user image transmitted.
- Model smoke using a bundled Bun artifact with `sharp` treated as a native external dependency: **PASS**.
- Bun bundled API (43.59 MB) started on an alternate loopback port; `GET /health`: **PASS**. Temporary process and build artifacts were stopped/removed.
- API `bunx tsc -p . --noEmit`: **PASS**.
- Ordinary API unit suite: **119 PASS, 7 guarded optional integration tests SKIPPED, 0 FAIL**.
- Web TypeScript + Vite production build: **PASS**.
- No real explicit image was needed or used in tests. Controlled sensitive-image sensitivity evaluation and VPS performance benchmarks remain outstanding.

## Continuation — isolated authenticated HTTP acceptance
- `bun test/seller-avatar-isolated-http.ts --isolated-synthetic-http`: **PASS**. Exercised actual API login, guest/buyer access denial, malformed image rejection, the **real bundled NSFW model** on a generated safe image, immediate publishing, guest WebP retrieval, versioned replacement, previous-file deletion, guest storefront refresh, removal, and audit records.
- `bun test/seller-avatar-reject-isolated-http.ts --simulated-screening-failures`: **PASS**. Injected **test-only** simulated explicit, uncertain, and model-unavailable decisions into the upload pipeline. All three blocked publication, preserved a synthetic existing picture, and cleaned rejected images. No real explicit imagery was involved.
- Both tests used only new disposable test accounts and local temporary images in `cpsu_marketplace_push_test`; test accounts, sessions, audits and images were deleted after completion. **Development and existing synthetic QA records were not changed.**
- Additional hardening: malformed probability totals are uncertain; at most four screenings may be queued; queue exhaustion returns `avatar_screening_busy` and preserves the current photo.
- Regression checks after hardening: **13 focused tests passed**, API TypeScript passed, production web build passed, both isolated HTTP scripts passed.
- These tests do not establish accuracy for real prohibited images or real-device browser UX; perform such acceptance with appropriately sourced/authorized evaluation content and deployment-specific privacy safeguards.

## Continuation — local CPU benchmark and mobile upload polish

- Guarded synthetic benchmark: `bun test/seller-avatar-screening-benchmark.ts --synthetic-benchmark`.
- Eight generated, harmless 512×512 WebP images with abstract colored backgrounds and shapes were classified by the real local MobileNetV2 model. **8/8 classified safe; no unexpected errors.**
- On this Windows development PC: average **816 ms/image**, first cold-start classification **1,258 ms**, maximum measured classification **1,258 ms**; observed process RSS increased by about **145 MiB**, with approximately **232 MiB** final RSS. These measurements include initialization and process/runtime effects. They are *not* a production VPS capacity guarantee or a prohibited-image accuracy evaluation.
- `apps/web/src/seller-avatar-editor.tsx` now announces **Uploading and checking…** while busy, and marks the upload form `aria-busy`. `apps/web/src/seller-avatar-editor.css` constrains the native file picker within narrow mobile layouts.
- The mobile interface refinements are source and build tested; **physical iPhone/Android UI acceptance was not completed**.
- Real explicit-image sensitivity evaluation, model false-positive characterization and hosting-specific memory/latency testing are required before launch. Seller reports and administrator removal stay essential.

## Release safety
This source change requires no MariaDB schema migration and does not modify existing student records. The currently running Bun watcher may reload changed source; deployment, commit/push and nonlocal enablement are separate decisions. The fail-closed approach means that broken inference can temporarily prevent new profile photo uploads rather than silently publishing unscanned content.
