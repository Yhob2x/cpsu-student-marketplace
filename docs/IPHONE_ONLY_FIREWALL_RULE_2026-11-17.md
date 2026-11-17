# iPhone-only LAN HTTPS firewall scope — 2026-11-17

**CPSU student marketplace, local Windows PC: DESKTOP-P5OAG7F**
**iPhone supplied private Wi-Fi IP:** `192.168.0.224`
**PC Wi-Fi IPv4:** `192.168.0.133/24`
**Status:** A targeted 8445 firewall exception is *not yet installed*; phone QA has not been started.

## Read-only verification
- `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart` previously passed firewall/Wi-Fi/TLS.
- QA HTTP ports `8445/4400/4173` not listening; development `0.0.0.0:4000` does listen.
- No enabled inbound port-specific rule for 8445 found.
- Four existing enabled Windows Defender Firewall **Bun executable** inbound Allow rules were discovered: TCP/UDP on Private and TCP/UDP on Public. Their port range and remote address were `Any`. These runtime rules may permit remote LAN clients to reach other Bun development listeners, so creating only an 8445 allow exception would not close this exposure.
- The remote command session is **not elevated**; no host firewall rules were edited.

## Fail-closed code safety improvement
Updated `scripts/wp3-iphone-lan-readiness-readonly.mjs` with an explicit read-only scan of enabled Windows-generated Bun inbound rules. It blocks prestart if an unrestricted enabled Bun rule covers the Private profile. No automatic disabling or firewall modification. Regression helper and tests in `scripts/iphone-lan-preflight-status.mjs` / `.test.mjs`: **5/5 pass** and JavaScript syntax passes. Actual live prestart now returns **exit 2**, with the single blocker `no unrestricted Bun inbound firewall allowance`. Existing firewall, Wi-Fi and TLS checks still PASS.

This query specifically covers unrestricted Bun inbound exceptions; it does not constitute a general firewall security certification.

## Owner-approved change still needed (administrator, not ChatGPT)
1. Review the existing Bun allow rules and, if no other authorized work depends on inbound LAN Bun connections, **disable the unrestricted Bun inbound allow rules**. This is a host OS policy action requiring explicit owner approval and administrative elevation. Do not delete unreviewed rules or stop unknown user processes.
2. Create a separate Windows firewall rule with: **Allow**, **Inbound**, **TCP**, **Private profile only**, **Local address 192.168.0.133**, **Local port 8445**, **Remote address 192.168.0.224**. No `Any` remote address, subnet-wide allow or exposure of 4400/4173. Only the Node HTTPS gateway should listen on 8445; internal QA API and web preview remain loopback.
3. Run the same prestart check after approving/applying changes and verify exit **0**, then inspect that precise 8445 rule. If rules are still broad or any check fails, stop.
4. Separately approve provisioning only two synthetic test identities and one synthetic published listing in `cpsu_marketplace_push_test`. The latest read-only QA DB inventory found zero users/sessions/listings/transactions.
5. Test physical Safari only after these controls, and clean up 8445 rule, test CA trust, isolated accounts and listeners after the session.

**No** firewall settings, student data, credentials, real/development databases, test accounts, migrations, commits, pushes, deployments or active QA services were changed in this step.

## 2026-11-17 — iPhone-only rule independently verified
After the owner applied the Windows firewall changes, independent inspection on DESKTOP-P5OAG7F confirmed:
- All three firewall profiles enabled and Wi-Fi category Private.
- Four Windows-generated bun.exe inbound allow rules are disabled (two Public, two Private).
- `CPSU-iPhone-QA-8445` is enabled, inbound Allow, Private profile only, TCP, local `192.168.0.133:8445`, remote `192.168.0.224`.
- Updated read-only `node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only --prestart` returned **exit 0**, including the unrestricted Bun allow audit, CA chain/SAN/fingerprint/key ACL checks.
- The three QA ports `8445,4400,4173` are still **not listening**. HTTPS gateway was **not started** and physical Safari was not tested.
- Isolated iPhone QA schema `cpsu_marketplace_push_test` has 24 tables, six applied migrations but 0 users, sessions, listings, transactions and status logs (read-only check exit 2 due to missing synthetic identities).
- **Next authorization gate:** owner consent to create exactly two disposable synthetic buyer/seller identities and one test listing *only in the isolated QA schema*, with private credential handling, explicit cleanup. No test records were inserted in this step; no app DB migrations, commits, pushes or deployment.
