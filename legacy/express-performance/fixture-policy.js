/** Validate synthetic identity pools without printing passwords or emails.
 * Each k6 VU gets its own test buyer AND test seller; sharing logins between VUs
 * would hide auth bottlenecks and produce misleading results.
 */
export function validateSyntheticAccountPools(accounts, maxVus) {
  if (!Number.isInteger(maxVus) || maxVus < 1 || !Array.isArray(accounts))
    throw Error('Synthetic fixture pools and a positive maximum VU count are required');
  const seen = new Set();
  const pools = { student: [], seller: [] };
  for (const account of accounts) {
    if (!account || typeof account.email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.test$/i.test(account.email) ||
        typeof account.password !== 'string' || account.password.length === 0 ||
        !['student', 'seller'].includes(account.role))
      throw Error('Every load identity must be a well-formed synthetic .test buyer or seller');
    const key = account.email.toLowerCase();
    if (seen.has(key)) throw Error('Duplicate synthetic identity in load fixture');
    seen.add(key);
    pools[account.role].push(account);
  }
  if (pools.student.length < maxVus || pools.seller.length < maxVus)
    throw Error('Mixed stage requires at least maxVus distinct buyer AND seller accounts');
  return pools;
}

export function syntheticAccountForVu(pools, vu, role) {
  if (!Number.isInteger(vu) || vu < 1 || !['student', 'seller'].includes(role))
    throw Error('Invalid synthetic load role or VU');
  return pools[role]?.[vu - 1] ?? null;
}
