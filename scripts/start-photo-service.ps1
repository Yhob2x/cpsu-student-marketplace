# Local-only supervised photo process. Ctrl+C stops this foreground supervisor.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..\photo-service')
while ($true) {
    Write-Host 'Starting private CPSU photo service on loopback...'
    bun run start --check-existing
    if ($LASTEXITCODE -in 0, 2) {
        exit $LASTEXITCODE
    }
    Write-Warning 'Photo service exited; retrying in 5 seconds.'
    Start-Sleep -Seconds 5
}
