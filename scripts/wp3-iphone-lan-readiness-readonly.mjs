/**
 * WP3 Gate C3 — local iPhone Safari testing READ-ONLY preflight.
 * No account provisioning, migrations, firewall changes, listener startup,
 * OS trust changes, credential output, or certificate-key reads.
 *
 * Run: node scripts/wp3-iphone-lan-readiness-readonly.mjs --read-only
 */
import { X509Certificate } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const prestart=process.argv.length===4 && process.argv[3]==='--prestart';
if ((process.argv.length!==3 && !prestart) || process.argv[2]!=='--read-only')
  throw new Error('Only --read-only or --read-only --prestart are supported.');
if(process.platform!=='win32')
  throw new Error('iPhone LAN QA preflight requires the approved Windows developer PC.');
const problems=[];
function report(ok,label,detail=''){
  console.log((ok?'PASS ':'BLOCKER ')+label+(detail?' — '+detail:''));
  if(!ok)problems.push(label);
}
function runPS(command) {
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{
    encoding:'utf8',windowsHide:true,timeout:10000,
  });
  if(p.status!==0)throw new Error('Read-only Windows state query failed.');
  return String(p.stdout).trim();
}
function objects(output){
  if(!output)return [];
  const data=JSON.parse(output);
  return Array.isArray(data)?data:[data];
}

const wifi=Object.entries(networkInterfaces()).flatMap(([alias,adapters])=>
  (adapters??[]).filter(n=>n.family==='IPv4' && !n.internal && n.netmask==='255.255.255.0' &&
  n.address.startsWith('192.168.') && /wi-fi|wireless/i.test(alias)).map(n=>({alias,ip:n.address})));
report(wifi.length===1,'exactly one trusted-test Wi-Fi interface','private /24 IPv4 interface expected');
const ip=wifi[0]?.ip;

let profiles=[];
try {profiles=objects(runPS('Get-NetFirewallProfile | Select-Object Name, Enabled | ConvertTo-Json -Compress')); }
catch{report(false,'Windows Firewall state readable');}
if(profiles.length) {
  for(const p of profiles)report(p.Enabled===true, 'Windows Firewall '+p.Name,'must be enabled for controlled device QA');
}
let nets=[];
try {nets=objects(runPS('Get-NetConnectionProfile | Select-Object InterfaceAlias, NetworkCategory | ConvertTo-Json -Compress')); }
catch{report(false,'Wi-Fi network trust category readable');}
if(wifi.length===1 && nets.length){
  const chosen=nets.find(n=>String(n.InterfaceAlias).toLowerCase()===wifi[0].alias.toLowerCase());
  report(!!chosen && chosen.NetworkCategory===1 || chosen?.NetworkCategory==='Private',
    'Wi-Fi trust category','expected Private for owner-controlled home network, not Public');
}

const base=join(process.env.LOCALAPPDATA??'', 'CPSU-Marketplace','iphone-lan-https');
const caPath=join(base,'root-ca.pem');
const leafPath=join(base,'iphone-lan.crt');
if(!existsSync(caPath)||!existsSync(leafPath))report(false,'existing HTTPS certificate files','no new certificates created');
else{
  try{
    const root=new X509Certificate(readFileSync(caPath));
    const leaf=new X509Certificate(readFileSync(leafPath));
    const now=Date.now();
    const valid=(x)=>Date.parse(x.validFrom)<=now && Date.parse(x.validTo)>now;
    report(valid(root)&&valid(leaf),'CA and server TLS certificate validity',
      'server expires '+new Date(leaf.validTo).toISOString().slice(0,10));
    report(leaf.ca===false && root.ca===true && root.verify(root.publicKey) &&
      leaf.verify(root.publicKey),'trusted local CA signed server leaf');
    report(root.fingerprint256.toUpperCase()===
      '35:C7:4C:12:81:FD:BA:B3:ED:3C:AC:97:64:28:22:5A:A8:1A:2C:82:27:75:0E:33:B2:3E:D2:3B:6D:1A:52:CF',
      'unchanged known iPhone testing CA fingerprint');
    if(ip)report(!!leaf.checkIP(ip),'server TLS SAN matches current Wi-Fi IP',
      'current local Wi-Fi address '+ip);
  }catch(e){
    report(false,'local certificate parsing/chain',
      e instanceof Error?e.name:'unknown error');
  }
}
// Check private-key ACL without reading either key's contents.
try{
  const keyAcl=runPS(`$base=Join-Path $env:LOCALAPPDATA 'CPSU-Marketplace\\iphone-lan-https'; $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name; $allow=@($user,'NT AUTHORITY\\SYSTEM','BUILTIN\\Administrators'); $bad=0; foreach($f in @('root-ca.key','iphone-lan.key')){ $path=Join-Path $base $f; if(!(Test-Path $path)){ $bad++; continue }; $a=Get-Acl -LiteralPath $path; foreach($entry in $a.Access){if($entry.IdentityReference.Value -notin $allow -and $entry.FileSystemRights.ToString() -match 'Read|FullControl|Modify'){ $bad++ }}}; Write-Output $bad`);
  report(Number(keyAcl)===0,'local CA/server private-key file permissions','no additional readable principals detected');
}catch{report(false,'private-key ACL check');}
let ports=[];
try{
  ports=objects(runPS(`Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { @('4173','4400','8445') -contains [string]$_.LocalPort } | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress`));
}catch{report(false,'QA service-listener state readable');}
if(prestart){
  console.log('PREFLIGHT MODE: before launch; listeners are verified separately by the launcher.');
}else if(ports.length){
  for(const [port,address] of [[8445,ip],[4400,'127.0.0.1'],[4173,'127.0.0.1']]){
    const found=ports.filter(p=>Number(p.LocalPort)===port);
    report(found.length===1 && found[0].LocalAddress===address,
      'LAN QA listener '+port,'expected bind '+(address??'[Wi-Fi IP missing]'));
  }
}else report(false,'all three LAN QA listeners available','no app server launched by this script');

console.log('WP3 IPHONE LAN PREFLIGHT: '+(problems.length?'NOT READY ('+problems.length+' blockers)':'LOCAL HOST CHECKS PASS'));
console.log('A real iPhone Safari session, certificate trust, test-only login and human accessibility checks are always manual.');
if(problems.length)process.exitCode=2;
