import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firewallProfileEnabled, namedFirewallProfileEnabled, wifiPrivateProfile, hasUnsafeBunInboundRules } from './iphone-lan-preflight-status.mjs';

// PowerShell's Get-NetFirewallProfile serializes the GpoBoolean enum True as JSON number 1.
test('accepts only affirmative Boolean or PowerShell GpoBoolean enabled', () => {
  assert.equal(firewallProfileEnabled(true), true);
  assert.equal(firewallProfileEnabled(1), true);
  for (const disabledOrUnexpected of [false, 0, 2, 'True', '1', null, undefined, {}, []]) {
    assert.equal(firewallProfileEnabled(disabledOrUnexpected), false);
  }
});
test('Windows Firewall JSON with three numeric enabled profiles is recognized', () => {
  const profiles = JSON.parse('[{"Name":"Domain","Enabled":1},{"Name":"Private","Enabled":1},{"Name":"Public","Enabled":1}]');
  assert.equal(profiles.every((p) => firewallProfileEnabled(p.Enabled)), true);
  profiles[1].Enabled = 0;
  assert.equal(profiles.every((p) => firewallProfileEnabled(p.Enabled)), false);
});

test('missing, duplicate or unexpected firewall profiles fail closed', () => {
  const profiles = [
    { Name: 'Domain', Enabled: 1 }, { Name: 'Private', Enabled: 1 }, { Name: 'Public', Enabled: 1 },
  ];
  for (const name of ['Domain', 'Private', 'Public']) {
    assert.equal(namedFirewallProfileEnabled(profiles, name), true);
    assert.equal(namedFirewallProfileEnabled(profiles.filter(p => p.Name !== name), name), false);
  }
  assert.equal(namedFirewallProfileEnabled([], 'Domain'), false);
  assert.equal(namedFirewallProfileEnabled([profiles[0], profiles[0]], 'Domain'), false);
  assert.equal(namedFirewallProfileEnabled([{ Name: 'Public', Enabled: 0 }], 'Public'), false);
});

test('Wi-Fi trust check fails closed if Windows omits or duplicates the connection profile', () => {
  const profiles = [{ InterfaceAlias: 'Wi-Fi', NetworkCategory: 1 }];
  assert.equal(wifiPrivateProfile(profiles, 'Wi-Fi'), true);
  assert.equal(wifiPrivateProfile([{ InterfaceAlias: 'Wi-Fi', NetworkCategory: 'Private' }], 'Wi-Fi'), true);
  for (const candidate of [
    [], null,
    [{ InterfaceAlias: 'Wi-Fi', NetworkCategory: 0 }],
    [{ InterfaceAlias: 'Wi-Fi', NetworkCategory: 'Public' }],
    [{ InterfaceAlias: 'Wi-Fi', NetworkCategory: 'DomainAuthenticated' }],
    [profiles[0], profiles[0]],
    [{ InterfaceAlias: 'Ethernet', NetworkCategory: 1 }],
  ]) assert.equal(wifiPrivateProfile(candidate, 'Wi-Fi'), false);
});

test('rejects unrestricted Bun firewall allowance on Private, not a restricted phone rule', () => {
  const bun = 'TCP Query User{abc}C:\\users\\acer\\bun.exe';
  assert.equal(hasUnsafeBunInboundRules([{Name:bun,Profile:2,LocalPort:'Any',RemoteAddress:'Any'}]), true);
  assert.equal(hasUnsafeBunInboundRules([{Name:bun,Profile:4,LocalPort:'Any',RemoteAddress:'Any'}]), false);
  assert.equal(hasUnsafeBunInboundRules([{Name:bun,Profile:2,LocalPort:'8445',RemoteAddress:'192.168.0.224'}]), false);
  assert.equal(hasUnsafeBunInboundRules([{Name:'CPSU iphone HTTPS',Profile:2,LocalPort:'8445',RemoteAddress:'192.168.0.224'}]), false);
  assert.equal(hasUnsafeBunInboundRules([]), false);
  assert.equal(hasUnsafeBunInboundRules(null), true);
});
