# WP3 Gate C3 — Physical iPhone Safari Acceptance Readiness

**Date:** 16 November 2026, Asia/Manila  
**PC:** DESKTOP-P5OAG7F  
**Project:** CPSU Student Marketplace  
**Decision:** **NOT READY for actual iPhone buyer/seller acceptance**. This review did **not** execute any iPhone Safari actions, create test accounts, change firewall/network profiles, start/stop network services, alter migrations, modify development/production records, commit or push.

## Verified read-only results

| Area | Evidence | Outcome |
|---|---|---|
| Approved temporary LAN Wi-Fi address | One Wi-Fi `192.168.0.133/24` connection | PASS — address only, not proof of a trusted network |
| Network category | Wi-Fi currently set to **Public** | **BLOCKER** for owner-only home-Wi-Fi testing |
| Windows Defender Firewall | **Domain, Private and Public all disabled** | **BLOCKER**, may expose other local dev listeners to the same network |
| TLS server certificate | Existing leaf signed by known personal QA CA; SAN matches current Wi-Fi IP | PASS |
| Certificate expiration | Leaf expires **30 Nov 2026**; CA was also in validity window at audit | PASS |
| Local CA fingerprint | `35:C7:4C:12:81:FD:BA:B3:ED:3C:AC:97:64:28:22:5A:A8:1A:2C:82:27:75:0E:33:B2:3E:D2:3B:6D:1A:52:CF` | PASS — matches prior QA setup |
| Private certificate keys | Restricted local file ACLs; no keys printed/copied | PASS |
| LAN HTTPS gateway | Existing process listens only at `192.168.0.133:8445` | PRESENT, but do not assume the overall system works |
| Web preview | Loopback `127.0.0.1:4173` | PRESENT |
| Test API | Loopback `127.0.0.1:4400` **not listening** | **BLOCKER**, authenticated/API actions cannot work |
| Test schema identity | `127.0.0.1:3306/cpsu_marketplace_push_test` | PASS: isolated local QA schema |
| Test schema migrations | Six applied including `20261116193000_wp3_transactions` | PASS for WP3; not the dev or production schema |
| Test schema data | 0 users, 0 sessions, 0 listings, 0 transactions, 0 status logs | **BLOCKER** for authenticated buyer/seller journeys. No demo logins exist. |
| Development DB safety | The last independent WP3 postcheck showed 22 listings, 0 WP3 records and six applied migrations | Verified separately; left unchanged |
| Real iPhone / Safari | Device not connected for remote Safari interaction or user testing | **PENDING**, never claim passed based on Chrome emulation |

This readiness check **did not** attempt to download/transfer the private CA key, use insecure TLS bypasses, or change a Windows networking setting. An existing LAN gateway is visible while the firewall is disabled: **avoid using the current state on any shared/public/school Wi-Fi.**

## New reproducible read-only checks

From the project root:

```powershell
node .\scripts\wp3-iphone-lan-readiness-readonly.mjs --read-only
```

From `apps/api`:

```powershell
bun scripts/wp3-iphone-qa-readonly.ts --read-only
```

Both scripts **fail closed** and report only environment state, aggregate test-only record counts and nonsecret certificate metadata. An exit code of `2` indicates not ready. Neither script starts servers, creates accounts, migrates, resets databases, logs private keys, or modifies the firewall. A green host preflight alone never confirms an actual Safari installation or user flow.

## Safe preparation order for the project owner

1. **Only use your own trusted home Wi-Fi and test phone.** Do not run this on school/campus guest Wi-Fi. Windows marks the current Wi-Fi **Public**; only change it to **Private** if you have verified it is your controlled trusted home network.
2. In **Windows Security → Firewall & network protection**, enable Windows Defender Firewall for applicable profiles. Enabling the firewall may interrupt current dev services. Limit any temporary inbound allowance to **TCP 8445 from your test iPhone's exact local IP only**; keep the local API `4400` and web preview `4173` bound to loopback. Do not create a broad `Any remote address` port exception. Review unrelated `4000/5173` development listeners, which may otherwise expose development resources.
3. **Only after network protections pass**, verify/launch the existing *isolated* iPhone QA services using `scripts/start-iphone-lan-https.ps1 -LocalOnly`. Do **not** launch while a known mismatched listener occupies a QA port. Then run the existing verified-TLS HTTPS test (no bypass) using `scripts/verify-iphone-lan-https.mjs` with the expected `CPSU_IPHONE_LAN_QA` and Wi-Fi IP environment flags.
4. **Do not reuse deleted demo credentials.** At the owner's separate authorization, create a short-lived **test-only buyer and seller** in the isolated QA schema with synthetic listings, approval/verification flags, and no real email identities or student data. Store any credentials privately on the PC, not in chat, source control, or screenshots; do not reset other data to accommodate fixtures. The test-only schema is currently empty. Cleanup of these identities and sessions must be verified after acceptance.
5. On the owner's **personal test iPhone** (not a student or university-managed device), transfer only `CPSU-Local-Dev-CA.cer` from the private QA directory. Compare the CA SHA-256 fingerprint above. If the owner elects to install/trust the root CA, follow Settings → General → VPN & Device Management and Settings → General → About → Certificate Trust Settings, with an explicit understanding that root CA trust can affect other HTTPS traffic. **Never bypass a certificate warning.**
6. In Safari on the same trusted Wi-Fi, visit `https://192.168.0.133:8445/` after the gateway and test API are confirmed ready. Test browser mode first; then Share → Add to Home Screen → Open as Web App (if offered). Do not expose this address outside your private LAN.
7. Run the human checks below using **only synthetic identities** and record failures with OS/Safari version, viewport, orientation, user role, and sanitized screenshots.

## Human Safari acceptance checklist — pending

- [ ] HTTPS opens without a certificate warning and without a bypass
- [ ] First launch, Home Screen install, app icon and back navigation behave as expected
- [ ] Buyer can request a synthetic listed item and is redirected to its private transaction
- [ ] Seller sees the buyer request and independently accepts it; item becomes reserved
- [ ] Buyer sees waiting status after own meetup confirmation; seller's confirmation advances meetup
- [ ] First completion alone does **not** mark item sold; second independent confirmation does
- [ ] Cancellation requires a 10–500-character reason, releases the right item's reservation, and has readable errors
- [ ] Reload, return from background, lost connection and retry do not create duplicate requests
- [ ] On-screen keyboard does not obscure the cancellation field, action button, or confirmation text
- [ ] Scroll behavior stays usable above the bottom navigation when the keyboard opens
- [ ] Portrait, landscape and 200% iOS text-size/accessibility settings do not hide controls
- [ ] VoiceOver labels, focus order, link targets, heading structure and status announcements make sense
- [ ] Sensitive notifications do not expose student/transaction content on a locked screen
- [ ] The second student's private transactions cannot be viewed by an unrelated test identity

Afterwards, shut down the three test-only services; verify closed listeners `8445/4173/4400`, **remove the local CA profile and SSL trust** from the test iPhone, and only after independent checks remove the synthetic test identities/sessions.

## Technical boundaries still in effect

- Previous **47 automated Chrome desktop/mobile-width checkpoints** passed. Chrome emulation is **not** physical iPhone Safari or VoiceOver acceptance.
- Gate B applied only WP3 to local development, while `20261116220000_managed_student_content` and `20261116221000_pending_announcement_edits` are still pending; **do not run the unscoped migration deploy command**.
- No production deployment, live notifications, payment gateway, actual student credentials, or public website exposure is authorized by this readiness stage.

## Development baseline follow-up observed during this read-only audit

An independent strict post-Gate-B check found the development schema still has the six applied WP3 migration records, 24 tables and the seven mandatory WP3 foreign keys, but **the Listing row count changed from the original 22 to 24**. Transaction and TransactionStatusLog each remain at **0**. Because that original postcheck intentionally requires exactly 22 legacy listing rows, it now **returns nonzero**, rather than claiming the original frozen-state hash or counts still match. This is consistent with two additional development listings being added since the earlier checkpoint, but the aggregate alone does **not** establish provenance or prove every individual original listing remains identical. No record correction or cleanup was attempted. Preserve these records and review any further changes through normal development governance.

**Stage C3 status:** Infrastructure and identity blockers documented; **manual device acceptance not started**.

## C4 continuation — fail-closed LAN iPhone QA startup (2026-11-16)

Following the C3 readiness findings, the existing HTTPS startup paths have been hardened **without enabling Windows Firewall, changing Wi-Fi trust, stopping anyone else's processes or creating any test identities**.

- `scripts/wp3-iphone-lan-readiness-readonly.mjs` now supports `--read-only --prestart`, verifying network, all firewall profiles, current existing certificate chain/SAN/fingerprint and private-key permissions **without requiring servers already to be running**.
- `scripts/start-iphone-lan-https.ps1 -LocalOnly` invokes this prestart guard **before** certificate setup, frontend builds or any service launch.
- `scripts/iphone-lan-https-gateway.mjs` runs the same prestart guard, preventing unsafe direct gateway launches that bypass the PowerShell entrypoint.
- Both actual startup attempts on the current PC **refused with nonzero exit codes** because all three firewall profiles remain disabled and Wi-Fi remains Public. The TLS certificate hash was unchanged by the launcher test.
- The prestart read-only command returned **exit 2** with four network blockers; malformed arguments returned **exit 1**, as expected. Node syntax checks passed.
- **Important: these guards run only at startup.** They do not close an **already running** gateway. During verification, an older gateway continued listening on `192.168.0.133:8445` and web preview on loopback `127.0.0.1:4173`. The isolated QA API on `127.0.0.1:4400` was absent. **Owner should close the earlier LAN gateway terminal while the firewall is disabled.** Do not kill unknown PID processes or alter unrelated local dev listeners.

Run the **prestart-only** security check with:

```powershell
node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart
```

Only after using a *confirmed owner-controlled home Wi-Fi* network, enabling Windows Firewall, configuring a narrow inbound iPhone-only exception for TCP 8445, and receiving separate approval for disposable test-only buyer/seller identities may the physical Safari login and transaction journeys proceed.

The read-only test database check still shows **zero test users**. No previously removed credentials were regenerated, and no actual iPhone interaction was performed.

**C4 result:** Prevented fresh unsafe LAN startup. Network setup, already-running legacy gateway shutdown, synthetic identity setup, and physical Safari acceptance remain pending owner actions.

### C4 regression result

- PowerShell launcher parser: **0 errors**. JavaScript syntax checks: **PASS**.
- Unsafe firewall/Public Wi-Fi prestart check: **correctly rejected** (exit 2).
- Attempted `start-iphone-lan-https.ps1 -LocalOnly` on the unsafe PC: **correctly rejected** (exit 1) before any build/launch; TLS certificate hash unchanged.
- Attempted direct gateway start: **correctly rejected** (exit 1) before binding.
- Focused WP3 safety suite: **26 passed, 0 failed**.
- Full API unit suite: an initial attempt raced another agent's incomplete new `reviewer-validation.ts` file and temporarily failed to import it; after that source file appeared, the **rerun passed 60, skipped 4, failed 0**. No unrelated source files were changed by this stage.
- API TypeScript: **PASS**; `git diff --check` on the two modified startup scripts: **PASS**.
- No Prisma schema/migration changes, test accounts, production operations, commits or pushes.


