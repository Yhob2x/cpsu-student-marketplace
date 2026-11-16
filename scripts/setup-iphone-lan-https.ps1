# CPSU Market: trusted-on-your-own-iPhone local HTTPS only, never production.
# Creates a short-lived local CA and LAN server certificate OUTSIDE the repository.
# Does not modify Windows trust stores, firewall rules, or any iPhone setting.
param([switch]$LocalOnly)
$ErrorActionPreference = 'Stop'
if (-not $LocalOnly -or $env:NODE_ENV -eq 'production') {
  throw 'Explicit -LocalOnly is required; production is not supported.'
}
$network = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
  Where-Object { $_.IPAddress -match '^192\.168\.[0-9]{1,3}\.[0-9]{1,3}$' -and $_.InterfaceAlias -match 'Wi-Fi|Wireless' })
if ($network.Count -ne 1 -or $network[0].PrefixLength -ne 24) {
  throw 'Expected exactly one private Wi-Fi IPv4 interface with /24 prefix. No keys were created.'
}
$lanIp = $network[0].IPAddress
$openssl = 'C:\xampp\apache\bin\openssl.exe'
if (-not (Test-Path -LiteralPath $openssl)) {
  $openssl = 'C:\Program Files\Git\usr\bin\openssl.exe'
}
if (-not (Test-Path -LiteralPath $openssl)) { throw 'OpenSSL not available in existing installations.' }
if (Test-Path 'C:\xampp\apache\conf\openssl.cnf') {
  $env:OPENSSL_CONF = 'C:\xampp\apache\conf\openssl.cnf'
}
$base = Join-Path $env:LOCALAPPDATA 'CPSU-Marketplace\iphone-lan-https'
New-Item -ItemType Directory -Force -Path $base | Out-Null
# Protect the directory before placing the CA private key in it.
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$grant = @(
  "*$($sid):(OI)(CI)F"
  '*S-1-5-18:(OI)(CI)F'
  '*S-1-5-32-544:(OI)(CI)F'
)
& icacls.exe $base /inheritance:r | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict certificate directory inheritance.' }
foreach ($entry in $grant) {
  & icacls.exe $base /grant:r $entry | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict certificate directory access.' }
}
$ca = Join-Path $base 'root-ca.pem'
$caKey = Join-Path $base 'root-ca.key'
$leaf = Join-Path $base 'iphone-lan.crt'
$leafKey = Join-Path $base 'iphone-lan.key'
$csr = Join-Path $base 'iphone-lan.csr'
$ext = Join-Path $base 'iphone-lan.ext'
$cer = Join-Path $base 'CPSU-Local-Dev-CA.cer'
# Preserve an existing valid root pair; never overwrite one half of a keypair.
$rootCount = @(@($ca,$caKey) | Where-Object { Test-Path -LiteralPath $_ }).Count
$leafCount = @(@($leaf,$leafKey,$cer) | Where-Object { Test-Path -LiteralPath $_ }).Count
if ($rootCount -eq 1 -or ($leafCount -gt 0 -and $leafCount -ne 3)) {
  throw 'Partial certificate/key pair: refusing to overwrite; inspect locally.'
}
# OpenSSL prints non-error keygen progress to stderr, which PowerShell 5.1 treats as errors
# under Stop. Capture exit codes instead of failing on progress notices.
$ErrorActionPreference = 'Continue'
if ($rootCount -eq 0) {
  & $openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 30 -keyout $caKey -out $ca -subj '/CN=CPSU Local Development CA' -addext 'basicConstraints=critical,CA:TRUE,pathlen:0' -addext 'keyUsage=critical,keyCertSign,cRLSign' 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the local root CA.' }
}
if ($leafCount -eq 0) {
  & $openssl req -new -newkey rsa:3072 -sha256 -nodes -keyout $leafKey -out $csr -subj "/CN=$lanIp" 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not create the LAN private key.' }
  @(
    'basicConstraints=critical,CA:FALSE'
    'keyUsage=critical,digitalSignature,keyEncipherment'
    'extendedKeyUsage=serverAuth'
    "subjectAltName=IP:$lanIp,IP:127.0.0.1,DNS:localhost"
  ) | Set-Content -LiteralPath $ext -Encoding ASCII
  & $openssl x509 -req -in $csr -CA $ca -CAkey $caKey -CAcreateserial -days 14 -sha256 -out $leaf -extfile $ext 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not sign the LAN certificate.' }
  & $openssl x509 -in $ca -outform DER -out $cer
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the iPhone public CA certificate.' }
  Remove-Item -LiteralPath $csr -Force -ErrorAction SilentlyContinue
}
$ErrorActionPreference = 'Stop'
foreach ($private in @($caKey,$leafKey)) {
  & icacls.exe $private /inheritance:r | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict key inheritance.' }
  foreach ($entry in @("*$($sid):F", '*S-1-5-18:F', '*S-1-5-32-544:F')) {
    & icacls.exe $private /grant:r $entry | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to restrict key access.' }
  }
}
& $openssl verify -CAfile $ca -purpose sslserver -verify_ip $lanIp $leaf
if ($LASTEXITCODE -ne 0) { throw 'Certificate expired, mismatched, or invalid for the Wi-Fi IP.' }
& $openssl x509 -in $ca -checkend 0 -noout
if ($LASTEXITCODE -ne 0) { throw 'Local development CA has expired.' }
Write-Output "LAN_IP=$lanIp"
Write-Output "PHONE_URL=https://$($lanIp):8445/"
Write-Output "PUBLIC_CA_FILE=$cer"
Write-Output 'ROOT_SHA256_FINGERPRINT:'
& $openssl x509 -in $ca -noout -fingerprint -sha256
& $openssl x509 -in $leaf -noout -enddate
Write-Output 'No trust-store installation, firewall change, public port, database write, or cloud tunnel performed.'
