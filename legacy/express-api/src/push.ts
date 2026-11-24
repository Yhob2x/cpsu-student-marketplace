import { createHash } from 'node:crypto';
import { env } from './env.js';
import { evaluatePushPolicy } from './push-policy.js';

export type PushCategory = 'messages' | 'listingReviews' | 'accountUpdates';
type EventData = Record<string, unknown>;
export type PushContent = {
  title: 'CPSU Market';
  body: string;
  url: string;
  tag: string;
  id: number;
  type: string;
  unread: number;
};

const HOSTS = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
]);

/** Push endpoint is a secret capability URL. Restrict hosts to browser push providers to prevent SSRF. */
export function permittedPushEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (!url.port || url.port === '443')
      && !url.username && !url.password && raw.length <= 2048
      && (HOSTS.has(url.hostname) || url.hostname.endsWith('.push.apple.com')
        || url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.wns.windows.com'));
  } catch { return false; }
}

export const endpointHash = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

// Separate subscription and outbound-delivery gates; never infer approval from VAPID keys alone.
const pushPolicy = evaluatePushPolicy(env);
export const pushReady = pushPolicy.subscriptionsEnabled;
// The durable integration remains gated until approved staging and physical-device acceptance.
export const durableOutboxWorkerActivated = false;
export const pushDeliveryReady = pushPolicy.deliveryEnabled && durableOutboxWorkerActivated;

const IMPORTANT_TRANSACTION_EVENTS = new Set([
  'transaction.requested', 'transaction.accepted', 'transaction.rejected',
  'transaction.meetup_confirmed', 'transaction.completion_confirmed', 'transaction.cancelled',
  'transaction.meetup_location_shared', 'transaction.meetup_location_revised',
]);

export function categoryForNotice(type: string): PushCategory | null {
  if (type === 'inquiry.new' || type === 'inquiry.reply') return 'messages';
  if (IMPORTANT_TRANSACTION_EVENTS.has(type)) return 'accountUpdates';
  if (type === 'listing.decision' || type === 'listing.suspended') return 'listingReviews';
  if (type === 'affiliation.decision' || type === 'store.new_listing') return 'accountUpdates';
  return null;
}

const safeNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Only generic text goes to lock screens. No message body, display name, listing title, or review reason. */
export function pushContent(type: string, data: EventData, notificationId: number, unread: number): PushContent | null {
  if (!categoryForNotice(type)) return null;
  let url = '/notifications';
  let body = 'You have a new marketplace update.';
  if (type === 'inquiry.new' || type === 'inquiry.reply') {
    const threadId = safeNumber(data.threadId);
    if (threadId) url = `/inquiries/${threadId}`;
    body = type === 'inquiry.new' ? 'You have a new marketplace inquiry.' : 'You have a new message.';
  } else if (type === 'listing.decision' || type === 'listing.suspended') {
    const listingId = safeNumber(data.listingId);
    if (listingId) url = `/listings/${listingId}`;
    body = type === 'listing.suspended' ? 'A listing needs your attention.'
      : data.decision === 'approved' ? 'Your listing was approved.' : 'Your listing has a review update.';
  } else if (type === 'affiliation.decision') {
    url = '/profile';
    body = 'Your CPSU account verification has an update.';
  } else if (IMPORTANT_TRANSACTION_EVENTS.has(type)) {
    const transactionId = safeNumber(data.transactionId);
    if (transactionId) url = `/transactions/${transactionId}`;
    body = type === 'transaction.requested'
      ? 'A student sent you a purchase or service request.'
      : 'The other student updated your transaction.';
  } else if (type === 'store.new_listing') {
    const listingId = safeNumber(data.listingId);
    if (listingId) url = `/listings/${listingId}`;
    // Do not expose store names, item titles or buyer interests on the lock screen.
    body = 'A store you follow has published a new listing.';
  }
  return { title: 'CPSU Market', body, url, tag: `cpsu-${notificationId}`, id: notificationId, type, unread: Math.max(0, unread) };
}
