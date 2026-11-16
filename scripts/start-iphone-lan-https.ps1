# CPSU Market personal iPhone PWA test. Windows Wi-Fi only; no hosting, tunnel or production DB.
# Run from repo: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-iphone-lan-https.ps1 -LocalOnly
param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
if (-not $LocalOnly -or $env:NODE_ENV -eq 'production') { throw 'LocalOnly required; production is refused.' }
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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
    Write-Output "These QA ports already have listeners. Check their identity before reuse: $($active -join ', ')."
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
