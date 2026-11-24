# CPSU Market personal iPhone PWA test. Windows Wi-Fi only; no hosting, tunnel or production DB.
# Run from repo: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-iphone-lan-https.ps1 -LocalOnly
param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
if (-not $LocalOnly -or $env:NODE_ENV -eq 'production') { throw 'LocalOnly required; production is refused.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Fail closed BEFORE any certificate setup, build, listener, or other side effect.
# This checks all firewall profiles, trusted home-network category, existing
# certificate chain/SAN and private-key ACLs. It never changes Windows settings.
$readiness = Join-Path $PSScriptRoot 'wp3-iphone-lan-readiness-readonly.mjs'
if (-not (Test-Path -LiteralPath $readiness)) { throw 'iPhone QA safety preflight missing; refusing LAN launch.' }
& node $readiness --read-only --prestart
if ($LASTEXITCODE -ne 0) {
  throw 'iPhone QA launch BLOCKED: firewall/network/certificate safety prerequisites not met. No services started by this launcher.'
}
& (Join-Path $PSScriptRoot 'setup-iphone-lan-https.ps1') -LocalOnly | Out-Null
$wireless = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.InterfaceAlias -match 'Wi-Fi|Wireless' -and $_.IPAddress -match '^192\.168\.' -and $_.PrefixLength -eq 24
})
if ($wireless.Count -ne 1) { throw 'Expected one 192.168.x.x/24 Wi-Fi adapter.' }
$ip = $wireless[0].IPAddress
$ports = @(4173, 4400, 8445)
$inUse = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $ports -contains $_.LocalPort })
if ($inUse.Count -ne 0) {
  $active = @($inUse | Select-Object -ExpandProperty LocalPort -Unique | Sort-Object)
  if ($active.Count -eq 3 -and $active[0] -eq 4173 -and $active[1] -eq 4400 -and $active[2] -eq 8445) {
    # A healthy HTTP response does not prove that a long-running Bun process
    # loaded the recently added server-side NSFW screening. Fail closed when
    # reusing an existing, outdated QA process.
    $qaListener = @(Get-NetTCPConnection -State Listen -LocalPort 4400 -ErrorAction SilentlyContinue |
      Where-Object { $_.LocalAddress -eq '127.0.0.1' })
    if ($qaListener.Count -ne 1) { throw 'Expected one loopback-only iPhone QA API listener at 127.0.0.1:4400.' }
    $qaProcess = Get-Process -Id $qaListener[0].OwningProcess -ErrorAction Stop
    if ($qaProcess.ProcessName -ne 'bun') { throw 'iPhone QA API port is not owned by Bun. Refusing to reuse.' }
    $safetyFiles = @(
      (Join-Path $repo 'apps/api/src/routes/seller.ts'),
      (Join-Path $repo 'apps/api/src/seller-avatar-screening.ts'),
      (Join-Path $repo 'apps/api/src/upload-security.ts')
    )
    foreach ($safetyFile in $safetyFiles) {
      if (-not (Test-Path -LiteralPath $safetyFile)) { throw "Required avatar safety source missing: $safetyFile" }
      if ($qaProcess.StartTime -lt (Get-Item -LiteralPath $safetyFile).LastWriteTime) {
        throw "iPhone QA API on port 4400 predates avatar screening changes. Stop ONLY the existing QA API terminal, verify port 4400 is free, and restart the guarded QA runner. Do not reuse stale HTTPS QA."
      }
    }
    Write-Output "Existing iPhone QA process passed avatar-source freshness check. Ports: $($active -join ', ')."
    Write-Output "Expected phone URL: https://$($ip):8445/"
    return
  }
  throw "QA port collision. Do not stop another agent's services: $($active -join ', ')."
}
Push-Location (Join-Path $repo 'apps\web')
try {
  & bun run build
  if ($LASTEXITCODE -ne 0) { throw 'Web build failed; QA not started.' }
} finally { Pop-Location }
$env:CPSU_IPHONE_LAN_QA = '1'
$env:CPSU_IPHONE_LAN_IP = $ip
# Three visible, independent terminals. Closing them stops LAN preview, isolated
# synthetic API and TLS gateway. Existing development servers are untouched.
Start-Process -FilePath 'cmd.exe' -WorkingDirectory (Join-Path $repo 'apps\web') -ArgumentList '/k','bun run preview --host 127.0.0.1'
Start-Process -FilePath 'cmd.exe' -WorkingDirectory (Join-Path $repo 'apps\api') -ArgumentList '/k','bun test/run-iphone-lan-pwa-api.ts'
Start-Process -FilePath 'cmd.exe' -WorkingDirectory $repo -ArgumentList '/k','node scripts/iphone-lan-https-gateway.mjs'
Write-Output "Started LAN-only HTTPS testing terminals; visit https://$($ip):8445/ from your trusted iPhone."
Write-Output 'Use test accounts only; do not expose the test URL outside your home Wi-Fi.'
