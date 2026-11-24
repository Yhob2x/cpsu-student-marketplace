import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaffAccount } from '../src/permissions.ts';

test('reviewer and administrator roles make an account staff even with a student affiliation', () => {
  assert.equal(isStaffAccount([{ role: 'campus_reviewer', campusId: 1 }]), true);
  assert.equal(isStaffAccount([{ role: 'university_admin', campusId: null }]), true);
  assert.equal(isStaffAccount([{ role: 'system_admin', campusId: null }]), true);
  assert.equal(isStaffAccount([{ role: 'establishment', campusId: 1 }]), true);
  assert.equal(isStaffAccount([]), false);
});
