import { describe, expect, it } from 'bun:test';
import { rowAccess, visibleListingRows } from '../src/row-access.js';
import type { AuthUser } from '../src/permissions.js';

const student: AuthUser = { id: 11, email: 'student@example.test', displayName: 'Student', roles: [] };
const reviewer: AuthUser = { id: 22, email: 'reviewer@example.test', displayName: 'Reviewer',
  roles: [{ role: 'campus_reviewer', campusId: 7 }] };
const universityAdmin: AuthUser = { id: 33, email: 'admin@example.test', displayName: 'Admin',
  roles: [{ role: 'university_admin', campusId: null }] };
const systemAdmin: AuthUser = { id: 44, email: 'system@example.test', displayName: 'System',
  roles: [{ role: 'system_admin', campusId: null }] };

describe('MariaDB application-enforced row scopes', () => {
  it('scopes private stores, listings, notifications, and saves to the actor', () => {
    expect(rowAccess.storeOwner(11)).toEqual({ ownerUserId: 11 });
    expect(rowAccess.listingOwner(11)).toEqual({ seller: { ownerUserId: 11 } });
    expect(rowAccess.notificationOwner(11)).toEqual({ userId: 11 });
    expect(rowAccess.savedListingOwner(11)).toEqual({ userId: 11 });
  });

  it('allows only inquiry and transaction participants', () => {
    expect(rowAccess.inquiryParticipant(11)).toEqual({
      OR: [{ buyerUserId: 11 }, { seller: { ownerUserId: 11 } }],
    });
    expect(rowAccess.transactionParticipant(11)).toEqual({
      OR: [{ buyerUserId: 11 }, { sellerUserId: 11 }],
    });
  });

  it('denies public access to draft, deleted, suspended and unapproved listings', () => {
    expect(visibleListingRows(undefined)).toEqual({
      status: 'published', deletedAt: null,
      seller: expect.objectContaining({ approvalStatus: 'approved', sellerType: 'student',
        owner: expect.objectContaining({ status: 'active', affiliations: { some: expect.objectContaining({ verificationStatus: 'verified' }) } }) }),
    });
  });

  it('lets a student see public items and their own private listings only', () => {
    expect(visibleListingRows(student)).toEqual({
      OR: [rowAccess.publicListing(), rowAccess.listingOwner(student.id)],
    });
  });

  it('restricts reviewers to their own campus, never a global wildcard', () => {
    expect(rowAccess.reviewListing(reviewer)).toEqual({ campusId: { in: [7] } });
    expect(rowAccess.reviewAffiliation(reviewer)).toEqual({ campusId: { in: [7] } });
    expect(rowAccess.reviewTransaction(reviewer)).toEqual({ listing: { campusId: { in: [7] } } });
    expect(visibleListingRows(reviewer)).toEqual({
      OR: [rowAccess.publicListing(), rowAccess.listingOwner(reviewer.id), { campusId: { in: [7] } }],
    });
  });

  it('does not grant system administrators broad reviewer access by default', () => {
    expect(rowAccess.reviewListing(systemAdmin)).toEqual({ campusId: { in: [] } });
    expect(visibleListingRows(systemAdmin)).toEqual({
      OR: [rowAccess.publicListing(), rowAccess.listingOwner(systemAdmin.id)],
    });
  });

  it('grants global listing review access only to global university administrators', () => {
    expect(rowAccess.reviewListing(universityAdmin)).toEqual({});
    expect(visibleListingRows(universityAdmin)).toEqual({});
  });

  it('fails closed for campus reviewers with no campus assignment', () => {
    const unassigned: AuthUser = { ...reviewer, roles: [{ role: 'campus_reviewer', campusId: null }] };
    expect(rowAccess.reviewAffiliation(unassigned)).toEqual({ campusId: { in: [] } });
    expect(visibleListingRows(unassigned)).toEqual({
      OR: [rowAccess.publicListing(), rowAccess.listingOwner(unassigned.id)],
    });
  });
});
