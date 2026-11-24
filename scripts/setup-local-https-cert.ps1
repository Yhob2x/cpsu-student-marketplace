# Test-only TLS certificate for CPSU PWA on https://localhost:8443.
# Does not trust or install the certificate. Never deploy or expose this server.
param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
if (-not $LocalOnly -or $env:NODE_ENV -eq 'production') {
  throw 'Explicit -LocalOnly required. Production certificate setup is not supported.'
}
$openssl = 'C:\xampp\apache\bin\openssl.exe'
$configuration = 'C:\xampp\apache\conf\openssl.cnf'
if (-not (Test-Path $openssl) -or -not (Test-Path $configuration)) {
  throw 'The existing XAMPP OpenSSL installation was not found.'
}
$directory = Join-Path $env:LOCALAPPDATA 'CPSU-Marketplace\staging-tls'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$cert = Join-Path $directory 'localhost.crt'
$key = Join-Path $directory 'localhost.key'
if ((Test-Path $cert) -xor (Test-Path $key)) {
  throw 'Only one of certificate/private key exists. Inspect locally; never overwrite silently.'
}
$env:OPENSSL_CONF = $configuration
if (-not (Test-Path $cert)) {
  & $openssl req -x509 -newkey rsa:2048 -nodes -keyout $key -out $cert -days 7 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create isolated HTTPS test certificate.' }
}
& $openssl x509 -in $cert -noout -checkend 0 | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Local test certificate expired; inspect and rotate it manually.'
}
$userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$grants = @(('*' + $userSid + ':F'), '*S-1-5-18:F', '*S-1-5-32-544:F')
& icacls.exe $key /grant:r $grants | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Private key ACL grant failed.' }
& icacls.exe $key /inheritance:r | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Private key ACL restriction failed.' }
if (@((Get-Acl -LiteralPath $key).Access | Where-Object IsInherited).Count -ne 0) {
  throw 'Inherited access to the private TLS key remains.'
}
Write-Output 'Localhost HTTPS certificate ready, private key ACL restricted.'
Write-Output 'Self-signed and NOT trusted for production, phones, or a public domain.'
& $openssl x509 -in $cert -noout -enddate
