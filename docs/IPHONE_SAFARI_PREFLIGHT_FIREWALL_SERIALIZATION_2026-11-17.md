# iPhone Safari LAN Security Preflight — Firewall Serialization Fix and Readiness

**Date:** 2026-11-17
**Device:** DESKTOP-P5OAG7F; local project only.
**Status:** **NOT READY** for physical iPhone Safari QA (one true host blocker and no synthetic QA accounts).

## Findings and changes
- The operator has enabled Windows Defender Firewall for **Domain, Private and Public** profiles. This was confirmed by `Get-NetFirewallProfile` (all `Enabled=True`).
- PowerShell's `Get-NetFirewallProfile | ConvertTo-Json` serializes its `GpoBoolean.True` enum as numeric **1**, not JSON Boolean `true`. The previous read-only preflight checked `p.Enabled === true`, incorrectly displaying all three enabled firewall profiles as blockers.
- Updated `scripts/wp3-iphone-lan-readiness-readonly.mjs` to use an explicitly strict profile state normalizer. Added pure `scripts/iphone-lan-preflight-status.mjs` and four `node --test` regression tests. Supported enabled encodings: Boolean `true` and numeric `1` only. Disabled/unknown/missing/duplicated profiles fail closed. Missing/duplicated/unknown Wi-Fi profile results also fail closed, preserving network trust gates.
- New preflight after fix: three **PASS** firewall profiles, HTTPS CA/leaf/SAN/permissions **PASS**, but Wi-Fi `NetworkCategory=Public` remains a **BLOCKER**. Exact command: `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart`, exit code **2**.
- No current listeners on QA ports **8445, 4400, 4173**. Read-only firewall query found no active inbound allow rule for **TCP 8445**. Existing development API `0.0.0.0:4000` is not a QA API and must not be exposed to the test iPhone.
- Read-only iPhone QA database inventory `bun scripts/wp3-iphone-qa-readonly.ts --read-only` checked **only** `cpsu_marketplace_push_test` (24 tables; six completed migrations, including WP3): **0** users, sessions, listings, transactions and status logs; returns exit 2 for missing synthetic QA identities. No inserts/migrations/resets were made.

## Tests run
- Four `node --test scripts/iphone-lan-preflight-status.test.mjs` checks: **4 passed**.
- `node --check scripts/wp3-iphone-lan-readiness-readonly.mjs`: **passed**.
- Real read-only prestart gate: **passes firewall; blocks Public Wi-Fi**. No unsafe TLS gateway startup.

## Next owner actions before physical Safari
1. Confirm this is **owner-controlled private home Wi-Fi** and not campus/public/guest Wi-Fi. Only then change the Windows Wi-Fi network category to **Private** (Windows Settings or elevated PowerShell `Set-NetConnectionProfile -InterfaceAlias 'Wi-Fi' -NetworkCategory Private`). Do not automatically change unknown networks to Private.
2. Re-run the same read-only prestart check and confirm **exit 0**. Verify the LAN firewall exception, if required, restricts TCP 8445 to **the personal iPhone's precise local IP**, while upstream QA ports remain loopback. Do not create a broad allow rule.
3. Obtain approval for disposable test-only buyer/seller identities; prepare only the isolated QA schema. No real university account or removed demo credentials.
4. Only then use the guarded `scripts/start-iphone-lan-https.ps1 -LocalOnly`, verified TLS and real iPhone Safari checklist in `docs/IPHONE_SAFARI_CONVERSATION_ACCEPTANCE_2026-11-17.md`.
5. Manual iPhone TLS trust, keyboard/scroll/VoiceOver and cleanup remain untested; do not label phone acceptance complete from PC checks.

**No** firewall/network settings changed by this assistant, QA server started, test account created, student data modified, database migration, commit, push or deployment.
