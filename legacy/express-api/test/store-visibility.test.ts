import { expect, test } from 'bun:test';
import { visibleStudentStoreWhere } from '../src/store-visibility';

test('public student stores require a current verified affiliation', () => {
  const beforeExpiry = new Date('2026-11-18T08:00:00Z');
  expect(visibleStudentStoreWhere(beforeExpiry)).toEqual({
    approvalStatus: 'approved', sellerType: 'student',
    owner: { status: 'active', roles: { none: {} }, affiliations: { some: {
      verificationStatus: 'verified', campus: { active: true },
      OR: [{ expirationAt: null }, { expirationAt: { gt: beforeExpiry } }],
    } } },
  });
});
