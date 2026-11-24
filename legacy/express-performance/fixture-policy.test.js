import { describe, expect, test } from 'bun:test';
import { validateSyntheticAccountPools, syntheticAccountForVu } from './fixture-policy.js';
const sample = [
  { email: 'buyer1@synthetic.test', role: 'student', password: 'synthetic' },
  { email: 'buyer2@synthetic.test', role: 'student', password: 'synthetic' },
  { email: 'seller1@synthetic.test', role: 'seller', password: 'synthetic' },
  { email: 'seller2@synthetic.test', role: 'seller', password: 'synthetic' },
];
describe('isolated synthetic k6 account assignment', () => {
  test('assigns separate buyer/seller pair for each VU', () => {
    const pools = validateSyntheticAccountPools(sample, 2);
    expect(syntheticAccountForVu(pools, 1, 'student')?.email).toBe(sample[0].email);
    expect(syntheticAccountForVu(pools, 2, 'student')?.email).toBe(sample[1].email);
    expect(syntheticAccountForVu(pools, 1, 'seller')?.email).toBe(sample[2].email);
    expect(syntheticAccountForVu(pools, 2, 'seller')?.email).toBe(sample[3].email);
    expect(syntheticAccountForVu(pools, 3, 'seller')).toBeNull();
  });
  test('rejects duplicate and live-looking identities before load', () => {
    expect(() => validateSyntheticAccountPools([...sample, { ...sample[0], email: 'BUYER1@synthetic.test' }], 2)).toThrow();
    expect(() => validateSyntheticAccountPools([{ ...sample[0], email: 'real@student.cpsu.edu.ph' }, ...sample.slice(1)], 2)).toThrow();
    expect(() => validateSyntheticAccountPools([{ ...sample[0], password: '' }, ...sample.slice(1)], 2)).toThrow();
    expect(() => validateSyntheticAccountPools(sample.slice(0, 3), 2)).toThrow();
    expect(() => validateSyntheticAccountPools(sample, 3)).toThrow();
    expect(() => validateSyntheticAccountPools(sample, 0)).toThrow();
  });
});
