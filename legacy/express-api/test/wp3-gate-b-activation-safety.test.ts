import { test, expect } from 'bun:test';
import {
  assertFreshWp3Backup, assertWp3ActivationAfter,
} from '../scripts/wp3-gate-b-activation-safety.js';
import { EXPECTED_APPLIED } from '../scripts/wp3-gate-b-readonly-policy.js';

const record = { name: '20261116193000_wp3_transactions', checksum: 'pinned', finished: true, rolledBack: false };
const listingBefore = [{ id: 1, price: '120.00', status: 'published' }];
const listingAfter = [{ ...listingBefore[0], reservationTransactionId: null }];
const existing = {
  user: { count: 1, hash: 'userhash' },
  listing: { count: 1, hash: 'before' },
  session: { count: 2, hash: 'sessionhash' },
  _prisma_migrations: { count: 5, hash: 'beforehistory' },
};
const migrated = {
  ...existing,
  listing: { count: 1, hash: 'after' },
  _prisma_migrations: { count: 6, hash: 'afterhistory' },
  transaction: { count: 0, hash: 'empty' },
  transactionstatuslog: { count: 0, hash: 'empty' },
};
const expectedForeignKeys = [
  'Listing_reservationTransactionId_fkey',
  'Transaction_inquiryThreadId_fkey', 'Transaction_listingId_fkey',
  'Transaction_buyerUserId_fkey', 'Transaction_sellerUserId_fkey',
  'TransactionStatusLog_transactionId_fkey', 'TransactionStatusLog_actorUserId_fkey',
];
const expectedIndexes = [
  'Transaction_activeThreadId_key', 'Listing_reservationTransactionId_key',
  'TransactionStatusLog_transactionId_id_idx',
];
const args = () => ({
  before: structuredClone(existing), after: structuredClone(migrated),
  oldListing: structuredClone(listingBefore), newListing: structuredClone(listingAfter),
  history: [...EXPECTED_APPLIED.map(name => ({name, finished: true, rolledBack: false})), record],
  foreignKeys: [...expectedForeignKeys], indexes: [...expectedIndexes],
});

test('Gate B requires fresh backup no older than 30 minutes and never accepts future snapshot', () => {
  const now = Date.parse('2026-11-16T14:00:00.000Z');
  expect(() => assertFreshWp3Backup('2026-11-16T13:58:00.000Z', now)).not.toThrow();
  expect(() => assertFreshWp3Backup('2026-11-16T12:00:00.000Z', now)).toThrow();
  expect(() => assertFreshWp3Backup('2026-11-16T14:01:01.000Z', now)).toThrow();
  expect(() => assertFreshWp3Backup('invalid', now)).toThrow();
});

test('Gate B validates only WP3 appended, preserves legacy listing data and required constraints', () => {
  expect(() => assertWp3ActivationAfter(args())).not.toThrow();
  const missing = args();
  missing.history = missing.history.slice(0,-1);
  expect(() => assertWp3ActivationAfter(missing)).toThrow();
  const other = args();
  other.history.push({name:'20261116220000_managed_student_content', finished: true, rolledBack: false});
  expect(() => assertWp3ActivationAfter(other)).toThrow();
});

test('Gate B refuses changed old data, non-null reservations, missing indexes and unexpected new rows', () => {
  const changed = args(); changed.after.user.hash = 'wrong';
  expect(() => assertWp3ActivationAfter(changed)).toThrow();
  const changedListing = args(); changedListing.newListing[0].price = '1.00';
  expect(() => assertWp3ActivationAfter(changedListing)).toThrow();
  const reserved = args(); (reserved.newListing[0] as {reservationTransactionId: number | null}).reservationTransactionId = 1;
  expect(() => assertWp3ActivationAfter(reserved)).toThrow();
  const missingFK = args(); missingFK.foreignKeys.pop();
  expect(() => assertWp3ActivationAfter(missingFK)).toThrow();
  const missingIndex = args(); missingIndex.indexes.pop();
  expect(() => assertWp3ActivationAfter(missingIndex)).toThrow();
  const nonempty = args(); nonempty.after.transaction.count = 1;
  expect(() => assertWp3ActivationAfter(nonempty)).toThrow();
});
