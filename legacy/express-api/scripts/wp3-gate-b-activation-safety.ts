/** Gate B WP3-only local activation assertions. No I/O, migrations or database writes. */
import { compareSnapshots, assertSameLegacyListingRows, type Snapshot, WP3_MIGRATION } from './wp3-restore-safety.js';
import { EXPECTED_APPLIED } from './wp3-gate-b-readonly-policy.js';

const FOREIGN_KEYS = [
  'Listing_reservationTransactionId_fkey',
  'Transaction_inquiryThreadId_fkey', 'Transaction_listingId_fkey',
  'Transaction_buyerUserId_fkey', 'Transaction_sellerUserId_fkey',
  'TransactionStatusLog_transactionId_fkey', 'TransactionStatusLog_actorUserId_fkey',
] as const;
const INDEXES = [
  'Transaction_activeThreadId_key', 'Listing_reservationTransactionId_key',
  'TransactionStatusLog_transactionId_id_idx',
] as const;

export function assertFreshWp3Backup(createdAt: string, now: number = Date.now()): void {
  const when = Date.parse(createdAt);
  if (!Number.isFinite(when) || when > now + 60_000 || now - when > 30 * 60_000)
    throw new Error('Gate B requires a new retained backup no older than 30 minutes.');
}

type Args = {
  before: Snapshot; after: Snapshot;
  oldListing: Record<string, unknown>[]; newListing: Record<string, unknown>[];
  history: {name:string; finished:boolean; rolledBack:boolean}[];
  foreignKeys: string[]; indexes: string[];
};

export function assertWp3ActivationAfter(input: Args): void {
  const { before, after, oldListing, newListing, history, foreignKeys, indexes } = input;
  const originalNames = Object.keys(before).sort();
  const nextNames = Object.keys(after).sort();
  if (nextNames.join('|') !== [...originalNames, 'transaction', 'transactionstatuslog'].sort().join('|'))
    throw new Error('Gate B WP3 altered the expected table catalog.');
  if (after._prisma_migrations?.count !== before._prisma_migrations?.count + 1)
    throw new Error('Gate B WP3 altered unexpected migration history.');
  const historyNames = history.map(r => r.name);
  const approvedNames = [...EXPECTED_APPLIED, WP3_MIGRATION];
  if (history.length !== approvedNames.length ||
      new Set(historyNames).size !== historyNames.length ||
      historyNames.slice().sort().join('|') !== approvedNames.slice().sort().join('|') ||
      history.some(r => !r.finished || r.rolledBack)) {
    throw new Error('Gate B WP3 did not create exactly one approved migration.');
  }
  const priorUnaffected = Object.fromEntries(Object.entries(before)
    .filter(([table]) => !['_prisma_migrations', 'listing'].includes(table)));
  const afterUnaffected = Object.fromEntries(Object.entries(after)
    .filter(([table]) => !['_prisma_migrations', 'listing','transaction','transactionstatuslog'].includes(table)));
  compareSnapshots(priorUnaffected, afterUnaffected);
  assertSameLegacyListingRows(oldListing, newListing);
  if (after.listing?.count !== before.listing?.count)
    throw new Error('WP3 changed the listing row count.');
  if (after.transaction?.count !== 0 || after.transactionstatuslog?.count !== 0)
    throw new Error('New WP3 transaction tables must be empty initially.');
  const fk = new Set(foreignKeys.map(x => x.toLowerCase()));
  const idx = new Set(indexes.map(x => x.toLowerCase()));
  if (FOREIGN_KEYS.some(x => !fk.has(x.toLowerCase())) ||
      INDEXES.some(x => !idx.has(x.toLowerCase())))
    throw new Error('Gate B WP3 is missing a mandatory foreign key or index.');
}
