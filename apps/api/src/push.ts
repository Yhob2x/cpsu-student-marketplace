import { createHash } from 'node:crypto';
import * as webPush from 'web-push';
import { prisma } from './db.js';
import { env } from './env.js';
import { evaluatePushPolicy } from './push-policy.js';

export type PushCategory = 'messages' | 'listingReviews' | 'accountUpdates';
type EventData = Record<string, unknown>;
export type PushContent = {
  title: 'CPSU Market';
  body: string;
  url: string;
  tag: string;
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
export const pushDeliveryReady = pushPolicy.deliveryEnabled;

export function categoryForNotice(type: string): PushCategory | null {
  if (type === 'inquiry.new' || type === 'inquiry.reply') return 'messages';
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
  } else if (type === 'store.new_listing') {
    const listingId = safeNumber(data.listingId);
    if (listingId) url = `/listings/${listingId}`;
    // Do not expose store names, item titles or buyer interests on the lock screen.
    body = 'A store you follow has published a new listing.';
  }
  return { title: 'CPSU Market', body, url, tag: `cpsu-${notificationId}`, unread: Math.max(0, unread) };
}

const VAPID = pushReady ? {
  subject: env.VAPID_SUBJECT!,
  publicKey: env.VAPID_PUBLIC_KEY!,
  privateKey: env.VAPID_PRIVATE_KEY!,
} : null;

/** Delivery is best-effort: in-app notification persistence must not depend on external push services. */
export async function deliverPush(userId: number, type: string, data: EventData, notificationId: number): Promise<void> {
  const category = categoryForNotice(type);
  if (!pushDeliveryReady || !VAPID || !category || env.NODE_ENV === 'test') return;
  const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (recipient?.status !== 'active') return;
  const preferences = await prisma.pushPreference.findUnique({ where: { userId } });
  if (preferences && !preferences[category]) return;
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    take: 8,
  });
  if (subscriptions.length === 0) return;
  const unread = await prisma.notification.count({ where: { userId, readAt: null } });
  const payload = pushContent(type, data, notificationId, unread);
  if (!payload) return;

  await Promise.allSettled(subscriptions.map(async (row) => {
    if (!permittedPushEndpoint(row.endpoint)) return;
    try {
      await webPush.sendNotification({
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
        expirationTime: row.expiresAt?.getTime() ?? null,
      }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal', vapidDetails: VAPID, timeout: 8000 });
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await prisma.pushSubscription.deleteMany({ where: { id: row.id, userId } });
      } else {
        // No endpoint, message contents, private keys, or device identifiers in logs.
        console.warn('Web Push delivery unavailable', { status: typeof code === 'number' ? code : 'network_error' });
      }
    }
  }));
}
