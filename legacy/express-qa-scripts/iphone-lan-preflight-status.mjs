// Windows Get-NetFirewallProfile.Enabled is a GpoBoolean enum.
// ConvertTo-Json emits the Enabled enum as numeric 1, not JSON true.
// Accept only affirmative forms; fail closed on disabled/unknown values.
export function firewallProfileEnabled(value) {
  return value === true || value === 1;
}

export function namedFirewallProfileEnabled(profiles, expectedName) {
  if (!Array.isArray(profiles)) return false;
  const matches = profiles.filter(p => p?.Name === expectedName);
  return matches.length === 1 && firewallProfileEnabled(matches[0].Enabled);
}

export function wifiPrivateProfile(profiles, wifiAlias) {
  if (!Array.isArray(profiles) || typeof wifiAlias !== 'string') return false;
  const matches = profiles.filter(p =>
    typeof p?.InterfaceAlias === 'string' &&
    p.InterfaceAlias.toLowerCase() === wifiAlias.toLowerCase());
  return matches.length === 1 &&
    (matches[0].NetworkCategory === 1 || matches[0].NetworkCategory === 'Private');
}

// The Windows interactive "allow Bun" rules can expose development listeners on
// every port to all peers on the Private LAN. Fail closed on missing audit data.
// This detects unrestricted rules (not narrower phone-only entries).
export function hasUnsafeBunInboundRules(rules) {
  if (!Array.isArray(rules)) return true;
  return rules.some(r => {
    const name = String(r?.Name ?? '');
    const profile = Number(r?.Profile ?? 0);
    const localPort = String(r?.LocalPort ?? '');
    const remote = String(r?.RemoteAddress ?? '');
    return /bun\.exe/i.test(name) && (profile & 2) !== 0 &&
      localPort.toLowerCase() === 'any' && remote.toLowerCase() === 'any';
  });
}
