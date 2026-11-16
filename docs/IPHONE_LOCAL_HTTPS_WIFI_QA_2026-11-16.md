# CPSU Market — private Wi-Fi HTTPS for personal iPhone PWA testing

**Date:** 16 November 2026. **Repository:** C:\Users\acer\Downloads\cpsu-student-marketplace. **Device:** DESKTOP-P5OAG7F. **Scope:** temporary local iPhone/PC QA only; not public deployment or real students.

## Result

- **HTTPS QA endpoint running on the Windows PC:** `https://192.168.0.133:8445/`.
- **Certificate:** locally generated short-lived CA and TLS server leaf, valid for `192.168.0.133` and loopback SANs. The server leaf expires **30 November 2026**, and the CA expires **16 December 2026** (UTC). Certificates expire naturally and are not automatically renewed.
- **CA fingerprint SHA-256:** `35:C7:4C:12:81:FD:BA:B3:ED:3C:AC:97:64:28:22:5A:A8:1A:2C:82:27:75:0E:33:B2:3E:D2:3B:6D:1A:52:CF`.
- Private CA key `root-ca.key` and TLS key `iphone-lan.key` are stored ONLY in `%LOCALAPPDATA%\CPSU-Marketplace\iphone-lan-https` with owner/admin/SYSTEM ACLs, outside Git and the website. No private keys were exported or copied to iPhone/ChatGPT.
- The **public certificate only**, `CPSU-Local-Dev-CA.cer` (DER format), can be transferred securely to the owner's iPhone for manual trust. Compare SHA-256 fingerprint before trusting.
- HTTPS gateway binds only `192.168.0.133:8445` with same-subnet request and expected Host checks; web production preview binds loopback `127.0.0.1:4173`, and isolated test API binds loopback `127.0.0.1:4400`.
- The test API is `NODE_ENV=test`, connected ONLY to the existing `cpsu_marketplace_push_test` schema, authenticated endpoints remain protected, and outbound push and subscription enrollment are disabled. No database migrations, production state changes, or real push operations.

## Code and scripts

- `scripts/setup-iphone-lan-https.ps1 -LocalOnly`: creates/verifies the short-lived CA and server cert, refuses partial/mismatched states, validates the Wi-Fi IP, locks down private key permissions. Does NOT alter OS trust, firewall, public DNS, or routing.
- `scripts/iphone-lan-https-gateway.mjs`: TLS-only LAN gateway to test API/production web preview with 192.168/24 guard, Host validation, safe upstream routing, and controlled forwarded headers.
- `apps/api/test/run-iphone-lan-pwa-api.ts`: guarded loopback test API, isolated schema, cookie Secure true, push off.
- `scripts/verify-iphone-lan-https.mjs`: HTTPS checks **with CA signature/hostname verification enabled**, manifest, icon, SW, API health, listings, unauthorized push access, wrong Host rejection.
- `scripts/start-iphone-lan-https.ps1 -LocalOnly`: rerun certificate checks; if all test ports are already active, stops without duplicating; otherwise checks ports, rebuilds the frontend, and launches three visible terminals that can be closed to stop QA.

## Verification completed on PC

- TLS CA chain, current Wi-Fi IP SAN and TLS server certificate: verified with OpenSSL.
- Web `bun run build`: PASS; PWA manifest/icons/service worker `node scripts/validate-pwa.cjs`: PASS.
- Node verifier with `rejectUnauthorized: true`: PASS for `/`, `/manifest.webmanifest`, `/sw.js`, `/icons/apple-touch-icon.png`, `/health`, `/api/v1/listings?pageSize=1` (HTTP 200); unsigned-in `/api/v1/push/config` correctly returned HTTP 401; mismatched HTTP Host returned 421.
- API TypeScript `bunx tsc -p tsconfig.json --noEmit`: PASS. The existing `apps/web/test/message-send-sound.test.ts` suite did **not** pass during this check because it imports a currently missing `../src/message-send-sound` file from unrelated in-progress work; this HTTPS task did not alter that test or file. The frontend production build passed again.
- Real iPhone Safari HTTPS trust, actual home-screen installation, icon, message keyboard and physical push behavior have NOT been verified.

## Important security limitation

This personal CA is NOT a publicly trusted CA. The user must explicitly trust it on the test iPhone. **Trusting a root CA enables it to certify other HTTPS names on that device**, so use it only on a personal test phone and remove the installed profile after QA. Never share or export `root-ca.key` or `iphone-lan.key`; never install this CA on students' phones or a production device. Do not bypass Safari TLS warnings.

**Windows security preflight found Windows Defender Firewall disabled for all three profiles**, and existing unrelated development listeners included `0.0.0.0:4000` and `0.0.0.0:5173`. This work did not change or stop them (multi-agent safety). These services may be reachable from the LAN. This temporary setup is **not** hardened for a shared/public Wi-Fi or real student data. Before a broader device rollout, enable appropriate Windows firewall protection and restrict inbound ports to a trusted network with explicit owner approval. Avoid real credentials and university records during this QA.

## Owner's iPhone steps (manual)

1. On **your own iPhone**, open the chat attachment `CPSU-Local-Dev-CA.cer` or privately transfer only that .cer file from the protected directory. Do not transfer either .key file. Compare the CA SHA-256 fingerprint above with the one shown in the certificate details if available.
2. Install the downloaded certificate profile in **Settings → General → VPN & Device Management → Profile Downloaded** (menu wording can differ by iOS version).
3. As Apple requires for manually installed CA roots, go to **Settings → General → About → Certificate Trust Settings**, find **CPSU Local Development CA** and enable full SSL trust. This is an explicit device-owner decision with broad CA trust implications.
4. Connect the iPhone to the same trusted home Wi-Fi as the PC. Keep Windows awake and the three test services running. Open **Safari → `https://192.168.0.133:8445/`**. There should be no certificate warning. If a warning remains, stop instead of bypassing it; confirm the trusted profile and IP.
5. Safari **Share → Add to Home Screen → Open as Web App (if available) → Add**, then open **CPSU Market** from Home Screen. Check installed mode, icon, message composer, navigation, and offline fallback. Use test/synthetic accounts only.
6. After testing, remove/disable the test CA via Settings → General → VPN & Device Management and Certificate Trust Settings. The local app stops working when its PC is off or when the private Wi-Fi IP changes.

Apple's official instructions for manual CA trust: https://support.apple.com/en-us/102390

## Restart and stop (PowerShell)

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-iphone-lan-https.ps1 -LocalOnly
```

The launcher opens three visible terminals for the static web preview, isolated QA API, and LAN HTTPS gateway. **Close those terminals to stop the test services.** If they are already running, do not start duplicates. The existing development API, Vite dev server, localhost-only push QA script, database credentials and VAPID configuration remain untouched. No Windows trust-store or firewall settings were modified. No commit, push, or deployment performed.

This is personal device QA. It is **not** a substitute for proper public HTTPS hosting, CPSU privacy/security acceptance or physical-device validation.


## 16 November: Temporary demo login cleanup

At the user's request, both temporary HTTPS test accounts and all their database password hashes were deleted from `cpsu_marketplace_push_test`, along with **six test sessions**, **two affiliations**, and **one empty seller profile**. A guarded transaction verified no listings, messages, transactions, reports or other business records were attached before deletion. The test schema now contains **zero users**.

The temporary demo credentials are no longer valid. Their account-specific seeding and login verification scripts have been retired. The original local development database, real accounts, and HTTPS certificate settings were not changed.

The existing development seed outside this iPhone QA setup remains separate and was not modified.
