# CPSU Market — Physical-device, classifier-accuracy and VPS release gates
Date: 2026-11-17, Asia/Manila
Scope: READ ONLY diagnostics, no deployment, no student account mutation.

## Verified today
- CPSU project is present on connected authorized Windows computer DESKTOP-P5OAG7F.
- The local NSFWJS screening module and previously written offline evaluation runner exist.
- No authorized prohibited-example manifest was found in the established private CPSU Market test storage under LocalAppData. Do **not** infer a zero false-negative rate from synthetic allowed images.
- `adb` is not installed on the connected Windows computer; no directly accessible physical Android test connection was verified. Apple USB automation tools were also unavailable.
- Local QA service status: port 4173 web preview, 4400 isolated test API, 8445 HTTPS gateway all listening.
- QA gateway on current local home Wi-Fi address `https://192.168.0.133:8445/` returned HTTP 200 from the Windows machine; public API `/api/v1/campuses` returned 200, and unauthenticated `/api/v1/seller/store` returned expected 401.
- Guarded fixture verification passed: the isolated QA DB has the existing two synthetic test users and published test listing.
- No new physical iPhone/Android interaction was observed by remote tooling. An HTTP 200 from the PC does not prove the phone can reach the site, trust its certificate, or upload media.
- No VPS connection or target server configuration was available to conduct an actual hosting-environment benchmark.

## Gate A — Authorize prohibited-image accuracy evaluation
- Use an explicitly approved **local** dataset with a demonstrable legal basis, provenance, age verification where relevant, representative allowed and disallowed categories, and a documented approved security/privacy handling process. Do not use real students' private images or unknown internet downloads.
- Prepare local folder outside repo and temp; `manifest.json` labels each image as `allowed` or `prohibited` without identifying the uploader.
- Run `bun scripts/seller-avatar-consented-evaluation.ts --evaluate-consented-local-images "C:\\PrivateAuthorizedAvatarEvaluation"` from `apps/api`.
- Capture aggregate counts: prohibited incorrectly accepted (`prohibitedPublishedSafe`, **false negatives**), prohibited blocked or held, allowed rejected or held (**false positives/holds**), technical failures.
- Do not give release approval merely because prohibited samples are blocked. Assess sample size, category coverage, reviewer agreement, false positive rate, and the possibility of adversarial examples.
- Status: **BLOCKED — authorized prohibited-image set not provided/found**.

## Gate B — Physical iPhone / Android
- Use the current *private home Wi-Fi*, not mobile data; open `https://192.168.0.133:8445/` from the actual handset. IP can change when the Wi-Fi network changes.
- Only proceed if the HTTPS certificate is trusted on that phone. Do **not** bypass unsafe certificate warnings or enter any student credentials into an untrusted page. If trust fails, stop and repair local QA certificate setup.
- Sign in with the previously created **synthetic seller** QA account; credentials remain in the private local file under `%LOCALAPPDATA%\\CPSU-Marketplace\\iphone-lan-https`, not in the chat/repository.
- Test `My Store > Store profile picture`: gallery selection, optional camera picker, preview, submit, the `Uploading and checking…` busy state, safe-image publish, new versioned URL/public store refresh, replacement, removal/initials. Use benign/generated test images only.
- For failure UX, use an isolated synthetic test with simulated classifier error responses; do not upload unapproved explicit imagery on a real phone.
- Test iPhone Safari **and** Android Chrome separately. Verify touch targets, keyboard, safe areas, screen orientation, error messages, retry behavior and no sideways overflow.
- Existing automated *desktop* Chrome mobile-width UI acceptance passed 17/17 checks at 320, 360 and 390px. That is **not** a physical handset test.
- Status: **BLOCKED for completion — human device interaction / screenshot or test observations required**.

## Gate C — Future VPS benchmarking
- Host not yet provisioned/connected in available environment. Never run VPS tests against live student media or production DB.
- Once a VPS is authorized and available, install project and dependencies with **Bun** on that server; use its own platform's native Sharp/argon2 binaries. Use a temporary local test media folder and synthetic generated images only.
- In a protected nonproduction checkout run `bun test/seller-avatar-screening-benchmark.ts --synthetic-benchmark` from `apps/api`. Record CPU, RAM, Bun version, model/runtime version, cold start latency, warmed latency, peak RSS, runs per minute and queue exhaustion under bounded synthetic requests; measure with realistic concurrent traffic too.
- Existing **Windows development PC** benchmark (8 synthetic images): mean 816 ms, cold start 1,258 ms, RSS increase ~145 MiB; these figures are **not VPS performance predictions**.
- Preserve fail-closed response and prepublication moderation under load. Benchmark on the actual VPS hardware before production release.
- Status: **BLOCKED — no authorized VPS/SSH target available**.

## Next action and privacy
The first completeable action is a physical iPhone QA pass on the existing local HTTPS site using the synthetic seller credentials and a benign test photo. Android requires a device/browser, and image-accuracy metrics need a separately approved local corpus. Production release should remain on hold pending all three gates.

No new database migration, real student record update, Git commit/push, or production deployment was performed for this release gate inspection.
