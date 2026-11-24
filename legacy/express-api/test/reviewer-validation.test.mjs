import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewerCreateSchema, reviewerEditSchema } from '../src/reviewer-validation.ts';

test('reviewer creation requires a valid campus, email, name and strong password', () => {
  assert.equal(reviewerCreateSchema.safeParse({ email: 'staff@cpsu.edu.ph', displayName: 'Campus Reviewer', campusId: 2, password: 'long-secret-123' }).success, true);
  assert.equal(reviewerCreateSchema.safeParse({ email: 'staff@cpsu.edu.ph', displayName: 'Campus Reviewer', campusId: 0, password: 'long-secret-123' }).success, false);
  assert.equal(reviewerCreateSchema.safeParse({ email: 'staff@cpsu.edu.ph', displayName: 'Campus Reviewer', campusId: 2, password: 'short' }).success, false);
  assert.equal(reviewerCreateSchema.safeParse({ email: 'staff@cpsu.edu.ph', displayName: 'Campus Reviewer', campusId: 2, password: 'long-secret-123', role: 'university_admin' }).success, false);
});

test('reviewer editing requires a reason and at least one changed detail', () => {
  assert.equal(reviewerEditSchema.safeParse({ displayName: 'New Name', reason: 'Corrected staff record' }).success, true);
  assert.equal(reviewerEditSchema.safeParse({ reason: 'No changes requested' }).success, false);
  assert.equal(reviewerEditSchema.safeParse({ campusId: 3, reason: 'Campus reassignment' }).success, true);
  assert.equal(reviewerEditSchema.safeParse({ status: 'suspended', reason: 'End of appointment' }).success, true);
  assert.equal(reviewerEditSchema.safeParse({ role: 'university_admin', reason: 'Promote account' }).success, false);
});
