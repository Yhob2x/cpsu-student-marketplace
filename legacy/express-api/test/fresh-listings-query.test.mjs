import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { freshListingIdsQuery } from '../src/fresh-listings-query.ts';

test('Fresh ranks by latest approval and excludes listings that are not public', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE User (id INTEGER, status TEXT);
      CREATE TABLE SellerProfile (id INTEGER, ownerUserId INTEGER, approvalStatus TEXT);
      CREATE TABLE Listing (id INTEGER, sellerProfileId INTEGER, status TEXT,
        availabilityState TEXT, deletedAt TEXT, createdAt TEXT);
      CREATE TABLE ListingReview (listingId INTEGER, decision TEXT, createdAt TEXT);
      INSERT INTO User VALUES (1, 'active'), (2, 'suspended');
      INSERT INTO SellerProfile VALUES (1, 1, 'approved'), (2, 2, 'approved');
      INSERT INTO Listing VALUES
        (1, 1, 'published', 'available', NULL, '2026-11-01 09:00:00'),
        (2, 1, 'published', 'available', NULL, '2026-11-14 09:00:00'),
        (3, 1, 'pending_review', 'available', NULL, '2026-11-15 09:00:00'),
        (4, 1, 'published', 'available', NULL, '2026-11-13 09:00:00'),
        (5, 2, 'published', 'available', NULL, '2026-11-16 09:00:00'),
        (6, 1, 'published', 'sold', NULL, '2026-11-16 09:00:00');
      INSERT INTO ListingReview VALUES
        (1, 'approved', '2026-11-02 09:00:00'),
        (1, 'changes_requested', '2026-11-15 11:00:00'),
        (1, 'approved', '2026-11-16 10:00:00'),
        (2, 'approved', '2026-11-14 10:00:00'),
        (3, 'approved', '2026-11-16 11:00:00');
    `);
    assert.deepEqual(db.prepare(freshListingIdsQuery.sql).all().map(row => row.id), [1, 2, 4]);
  } finally {
    db.close();
  }
});
