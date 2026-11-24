# CPSU Market — Local iPhone QA API requires an authorized runtime restart

**Checked:** November 17, 2026 (Asia/Manila). No real student data modified.

## Important discovery

- The LAN-only iPhone QA API is running on `127.0.0.1:4400` behind the existing trusted-home-Wi-Fi HTTPS gateway `https://192.168.0.133:8445/`.
- At inspection, port `4400` belonged to Bun process **PID 30012**, started **10:14:28 +08:00**.
- The current source files were last modified later: `apps/api/src/routes/seller.ts` **10:35:57**, `apps/api/src/seller-avatar-screening.ts` **10:47:20**.
- Therefore, the phone-facing QA API process predates the updated moderation implementation. Source-code tests alone **do not prove** this existing process enforces NSFW screening. Do not treat the phone QA instance as safety-verified until restarted and retested.
- The remote agent could not stop PID 30012: both Windows PowerShell `Stop-Process` and the authorized Remote Desktop Commander process operation returned **Access denied / EPERM**. **No privilege bypass attempted**.
- Site probe of existing HTTPS gateway returned HTTP 200 and `/api/v1/seller/store` returned expected 401 unauthenticated; these only confirm routing/authentication, not content screening.

## Latest isolated source tests — PASS

Re-ran against current source, using isolated/disposable synthetic accounts and harmless images:
- **13 targeted unit tests passed**, 0 failed.
- `bun test/seller-avatar-isolated-http.ts --isolated-synthetic-http`: **PASS** (12 upload, replacement, access and audit checks, real model on generated safe images).
- `bun test/seller-avatar-reject-isolated-http.ts --simulated-screening-failures`: **PASS** (simulated explicit, uncertain, unavailable decisions; prior avatar preserved; rejected temporary images cleaned).
- `bun test/seller-avatar-evaluation-harness-smoke.ts --benign-corpus-only`: **PASS** (3 generated safe examples). This is *not* a sensitivity or prohibited-content accuracy test.
- Disposable QA accounts/images cleaned. Tests did **not** change development DB, apply migrations, deploy, commit or push.

## November 17 continuation — stale QA process prevention

- Added a fail-closed source-freshness guard to `scripts/start-iphone-lan-https.ps1` when the three QA ports (4173, 4400, 8445) are already occupied.
- The launcher now requires the port-4400 listener to be a single loopback-only Bun process and checks that it started **after** the current seller upload route, NSFW screening module, and image sanitization module were last modified.
- If an older process is reused, it displays a clear refusal and instructs the operator to restart only the QA API from its authorized terminal. It neither stops other programs nor bypasses Windows process permissions.
- A read-only validation of the currently running QA service found **2 newer safety source files** compared with the old process, which means the guard would correctly block stale reuse.
- PowerShell script parser reported **zero syntax errors** and `git diff --check` passed.
- This is a startup heuristic only; a newer process start time does not replace an actual authenticated upload and explicit/uncertain rejection acceptance test. No physical-device completion or go-live approval is implied.

## How the authorized PC operator can refresh ONLY the existing QA API

1. In Windows on the connected PC, locate the **existing** terminal running `bun test/run-iphone-lan-pwa-api.ts` for test port **4400**. Press **Ctrl+C** to stop that test API only. Leave the normal API port 4000, web port 5173, HTTPS gateway 8445 and QA web preview 4173 untouched.
2. Check that port 4400 is free using `Get-NetTCPConnection -State Listen -LocalPort 4400 -ErrorAction SilentlyContinue`. If another process still owns it, close its **authorized** QA terminal. Do not elevate privileges or kill unrelated processes.
3. From a **new PowerShell session** started on that PC by the owner, run:

```powershell
cd C:\Users\acer\Downloads\cpsu-student-marketplace\apps\api
$env:CPSU_IPHONE_LAN_QA = '1'
$env:CPSU_IPHONE_LAN_IP = '192.168.0.133'
bun test/run-iphone-lan-pwa-api.ts
```

The runner checks the local Wi-Fi adapter, requires a local source `DATABASE_URL`, **redirects its connection to the isolated `cpsu_marketplace_push_test` schema**, sets local-only media storage, disables Drive credentials and push, and binds only loopback `127.0.0.1:4400`. Do not bypass those checks. If the home Wi-Fi address changed, re-run the existing read-only QA preflight and regenerate only the appropriate local QA launch configuration.

4. In a second terminal, confirm `http://127.0.0.1:4400/health` responds HTTP 200 and the new port-4400 process start time is later than the current screening source file modification time.
5. Open `https://192.168.0.133:8445/` from the actual iPhone **on trusted home Wi-Fi** (never accept an untrusted certificate) using only the previously prepared synthetic seller credentials in the restricted local QA file. Upload a normal harmless generated photo, replace it and check the public store. Do not upload real or explicit images to test moderation.
6. Check Android separately if a physical device becomes available; an Android command-line debugging installation was **not** found in this environment.

## Release gates still open

- Authorized labeled prohibited-image corpus is not available, so accuracy/sensitivity has **not** been validated.
- No physical iPhone upload verification was observed from this ChatGPT session; Android device testing was unavailable.
- No authorized VPS was connected; the previous Windows CPU benchmark is not hosting performance evidence.

**Do not approve public launch yet.** This runbook does not authorize any database migration, deployment, Git push or access-right escalation.
