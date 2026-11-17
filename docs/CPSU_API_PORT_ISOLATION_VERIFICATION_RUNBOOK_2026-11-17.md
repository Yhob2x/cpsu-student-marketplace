# CPSU Market — API direct-port isolation verification procedure

**Record ID:** CPSU-OPS-NET-01 | **Prepared:** 2026-11-17
**Status:** SOURCE INSPECTED / LIVE TEST NOT RUN.
**Test owner, target hostname/IP, authorized source, maintenance window, approved port, redaction rules:** **PENDING OPERATOR AUTHORIZATION**.

## Security property and context
Only approved HTTPS ingress to Nginx may reach the marketplace API. Direct access to the API's TCP listening port from another machine must fail. This is a server/network guarantee, **not** a frontend or CSS check.

Source evidence:
- `apps/api/src/env.ts` requires `BIND_HOST=127.0.0.1` and `COOKIE_SECURE=true` when `NODE_ENV=production`. `src/index.ts` binds to those values. A local dev process may bind more broadly; do not confuse local development with deployment.
- Production `infrastructure/nginx/marketplace.conf` proxies `/api/` to `127.0.0.1:4000`. Isolated staging `infrastructure/staging/nginx.conf.template` proxies to `127.0.0.1:4400`; approved staging env template specifies `BIND_HOST=127.0.0.1`.
- **Known additional blocker:** `infrastructure/deploy/cpsu-marketplace-api.service` currently starts Node (`/usr/bin/node`), while the API is built for and launched with Bun. Align and test this **separately** before any actual service deployment.
- No VPS, deployed host firewall, real certificate, active listener, security-group rules or remotely observable ingress has been inspected. Template review is not proof.

## Phase 0 — authorization / topology confirmation (required)
1. Security/network owner provides the exact authorized **origin server public IP**, staging/production role and port (expected **4400 staging**, **4000 production** only if that is how the approved service runs).
2. Record service identity, effective systemd runtime, HTTPS hostname, reverse proxy (including any CDN/load balancer), Nginx routing, operating-system firewall and cloud firewall/security group owner. Confirm that external test source is independent of the API host, and the approved hostname points to the intended service.
3. Obtain explicit permission for a **single TCP connectivity probe on the single authorized port**, plus one HTTPS `GET` to a known public API endpoint. Do not scan other ports or guess an IP.

## Phase 1 — on the approved Linux server (READ-ONLY commands)
Run under an authorized operator account; redact host identifiers and configuration before sharing. Do not include environment secrets or raw logs containing access tokens.

    sudo ss -ltnp '( sport = :4400 )'
    sudo systemctl status cpsu-marketplace-staging-api --no-pager
    sudo nginx -t
    sudo ufw status verbose

Or, when the host uses nftables rather than UFW:

    sudo nft list ruleset

For production replace 4400 with the **approved** production port and service name. Expect the API listener to show **127.0.0.1:<approved port> only**, not `0.0.0.0`, `[::]`, the host's public IPv4/IPv6 address or a Docker/NAT published host port. Inspect cloud firewall/security groups and container port publishing **separately**; `ss` and `ufw` alone cannot prove external isolation.
The service may run from a packaged or systemd-provided env; confirm effective `NODE_ENV`, `BIND_HOST`, `PORT` and `COOKIE_SECURE` **without displaying secret values**.

## Phase 2 — from a DIFFERENT, explicitly authorized client
On a Windows administrator workstation, use the prepared **read-only** script in dry-run mode first:

    powershell -NoProfile -File .\scripts\verify-api-port-isolation.ps1 -TargetHost '<approved-origin-IP-or-DNS>' -ApiPort 4400 -HttpsOrigin 'https://<approved-staging-domain>'

After explicit operator approval and independent source/target verification, add `-RunApprovedCheck` to run exactly one TCP connectivity check and one HTTPS `GET /api/v1/guidelines`. The endpoint is present in `apps/api/src/routes/public.ts`; the script verifies HTTPS returned JSON with the expected `body` field, not a PWA HTML fallback.

**Expected result:** direct TCP port **unreachable**, but HTTPS-through-Nginx **returns API JSON**. Reconfirm host identity and routing, else a false-negative direct test is possible (e.g., probing a DNS CDN address instead of the origin server).
If direct port opens, **FAIL**: stop the release, verify bind host/NAT, host/cloud firewall, container port mapping and the active service.
If HTTPS is unreachable, **INCONCLUSIVE**: a closed port plus a broken HTTPS service cannot demonstrate a working isolated deployment.
If either result varies by network or address family, repeat with approved external IPv4/IPv6 vantage points and record them.

## Phase 3 — evidence and acceptance
Capture UTC timestamp; approved target **as a redacted host identifier**; source network, authorized change ticket, exact TCP port, relevant `ss` listener binding (with PIDs and secrets redacted), Nginx validation, firewall and cloud controls, HTTPS certificate hostname/status, one direct-negative result and one proxy-positive JSON result. Record CDN / IPv6 paths separately.
Do not change firewall rules, nginx/systemd files, DNS or service processes during this read-only procedure. Any remediation needs a separate change authorization and rollback plan.

**Acceptance form (unfilled):**
- Approved target / source / date: **PENDING**
- Loopback listener evidence: **NOT TESTED**
- Host + cloud firewall/NAT evidence: **NOT TESTED**
- External direct-port denial: **NOT TESTED**
- HTTPS API routing: **NOT TESTED**
- IPv6 coverage and CDN/port publishing: **PENDING TOPOLOGY**
- Operator, reviewer and security owner signatures: ____________________
- **Gate:** BLOCKED until deployed-host verification passes and separate operational sign-off is recorded.
