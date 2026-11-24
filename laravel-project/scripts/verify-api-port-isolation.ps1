# Read-only, explicitly approved, single-target external API port isolation check.
# With no -RunApprovedCheck, prints preview ONLY and makes no network request.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$TargetHost,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$ApiPort,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$HttpsOrigin,

    [switch]$RunApprovedCheck
)

$ErrorActionPreference = 'Stop'
$origin = $null
if (-not [Uri]::TryCreate($HttpsOrigin, [UriKind]::Absolute, [ref]$origin) -or
    $origin.Scheme -ne 'https' -or $origin.UserInfo -or
    $origin.Query -or $origin.Fragment -or $origin.AbsolutePath -ne '/') {
    throw 'Use an approved HTTPS origin only, e.g. https://staging.example.edu.ph (no path, credentials or query).'
}
if ($TargetHost -in @('localhost', '127.0.0.1', '::1') -or $origin.Host -in @('localhost', '127.0.0.1', '::1')) {
    throw 'BLOCKED: a localhost probe does not verify external API isolation.'
}

$endpoint = $origin.AbsoluteUri.TrimEnd('/') + '/api/v1/guidelines'
if (-not $RunApprovedCheck) {
    Write-Output 'PREVIEW ONLY - no TCP or HTTPS probe was sent.'
    Write-Output "Planned: one TCP connect test to $($TargetHost):$ApiPort"
    Write-Output "Planned: one HTTPS GET to $endpoint"
    Write-Output 'Run only after written authorization for this exact origin IP, source, and API port.'
    exit 0
}

# The operator must separately confirm that TargetHost is the authorized origin,
# not a CDN or unrelated IP. This script never scans a port range or modifies settings.
Write-Output "CHECK_START_UTC=$((Get-Date).ToUniversalTime().ToString('o'))"
$directReachable = $false
try {
    $directReachable = [bool](Test-NetConnection -ComputerName $TargetHost -Port $ApiPort -InformationLevel Quiet -WarningAction SilentlyContinue)
} catch {
    Write-Output 'TCP_CHECK=INCONCLUSIVE (client/network diagnostic failure)'
    throw
}
Write-Output ('DIRECT_API_PORT=' + $(if ($directReachable) { 'OPEN' } else { 'CLOSED_FROM_THIS_SOURCE' }))

$httpsOk = $false
try {
    $response = Invoke-WebRequest -Uri $endpoint -Method GET -UseBasicParsing -TimeoutSec 15
    $body = $response.Content | ConvertFrom-Json
    $contentType = [string]$response.Headers['Content-Type']
    $httpsOk = $response.StatusCode -eq 200 -and
        $contentType -match 'application/json' -and
        $null -ne $body.PSObject.Properties['body']
} catch {
    Write-Output 'HTTPS_API_PROXY=INCONCLUSIVE (no valid response)'
}
Write-Output ('HTTPS_API_PROXY=' + $(if ($httpsOk) { 'JSON_CONFIRMED' } else { 'FAILED_OR_INCONCLUSIVE' }))
if ($directReachable) {
    throw 'FAIL: authorized origin API port is reachable directly. Keep release blocked.'
}
if (-not $httpsOk) {
    throw 'INCONCLUSIVE: HTTPS API routing did not pass. Keep release blocked.'
}
Write-Output 'PASS_FROM_APPROVED_SOURCE: direct API port denied and HTTPS proxy API returned expected JSON.'
Write-Output 'This does not replace on-host listener, cloud firewall, NAT, IPv6 and topology verification.'
