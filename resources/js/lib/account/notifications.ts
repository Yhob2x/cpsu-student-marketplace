import type { IconName } from '@/components/icons';
import { FOLLOWED_STORE_NOTICE_KIND, followedStoreNoticeText, followedStoreNoticeTarget } from '@/lib/stores/followed-store-notice';

export type Notice = { id: number; type: string; payload: any; readAt: string | null; createdAt: string };

const DECISION: Record<string, string> = { approved: 'was approved', changes_requested: 'needs changes', rejected: 'was rejected' };

// Turns a stored notification row into one plain sentence. Unknown types stay visible but generic,
// so adding an event on the server never leaves a blank entry here.
export function noticeText(n: Notice): string {
  const p = n.payload ?? {};
  const title = typeof p.title === 'string' && p.title ? `"${p.title}"` : 'Your listing';
  switch (n.type) {
    case 'inquiry.new': return `New inquiry about ${p.listingTitle ?? 'your listing'}.`;
    case 'inquiry.reply': return `New reply about ${p.listingTitle ?? 'your listing'}.`;
    case 'store.new_listing': return followedStoreNoticeText(p);
    case 'affiliation.decision':
      return p.decision === 'verified'
        ? 'Your CPSU affiliation was verified. You can open a store and publish listings.'
        : `Your affiliation was rejected${p.reason ? `: ${p.reason}` : '.'}`;
    case 'listing.decision':
      return `${title} ${DECISION[p.decision] ?? 'was reviewed'}.${p.reason ? ` Reason: ${p.reason}` : ''}`;
    case 'listing.suspended':
      return `A listing of yours was suspended by a reviewer.${p.reason ? ` Reason: ${p.reason}` : ''}`;
    case 'transaction.requested': return 'A student sent you a purchase or service request.';
    case 'transaction.accepted': return 'The seller accepted your request.';
    case 'transaction.rejected': return 'The seller rejected your request. Review the transaction history.';
    case 'transaction.negotiating': return 'The other student marked your transaction as being discussed.';
    case 'transaction.meetup_confirmed': return 'The other student confirmed meetup arrangements. Your confirmation may still be needed.';
    case 'transaction.meetup_location_shared': return 'The other student shared a meetup location and time. View the map.';
    case 'transaction.meetup_location_revised': return 'The meetup location changed. Both students need to confirm the new arrangement.';
    case 'transaction.completion_confirmed': return 'The other student reported completion. Both confirmations are required.';
    case 'transaction.cancelled': return 'The other student cancelled the transaction. Review the recorded reason.';
    default: return 'Marketplace update.';
  }
}

// Where a notification takes you when clicked; null keeps the row a plain, non-clickable article.
export function noticeTarget(n: Notice): string | null {
  const p = n.payload ?? {};
  if (n.type === 'inquiry.new' || n.type === 'inquiry.reply') return p.threadId ? `/inquiries/${p.threadId}` : null;
  if (n.type === 'listing.decision' || n.type === 'listing.suspended') return p.listingId ? `/listings/${p.listingId}` : null;
  if (n.type === 'store.new_listing') return followedStoreNoticeTarget(p);
  if (n.type === 'affiliation.decision') return '/profile';
  if (n.type.startsWith('transaction.') && Number.isSafeInteger(p.transactionId) && p.transactionId > 0)
    return `/transactions/${p.transactionId}`;
  return null;
}

type NoticeGroup = 'Today' | 'Yesterday' | 'Earlier';

export type NoticeFilter = 'all' | 'unread';

export function notificationGroup(createdAt: string): NoticeGroup {
  const date = new Date(createdAt);
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = new Date(dayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= dayStart) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

export function notificationKind(n: Notice): { title: string; label: string; icon: IconName; tone: string } {
  switch (n.type) {
    case 'inquiry.new': return { title: 'New inquiry', label: 'Messages', icon: 'chat', tone: 'message' };
    case 'inquiry.reply': return { title: 'New reply', label: 'Messages', icon: 'chat', tone: 'message' };
    case 'store.new_listing': return FOLLOWED_STORE_NOTICE_KIND;
    case 'listing.decision': {
      const decision = n.payload?.decision;
      const title = decision === 'approved' ? 'Listing approved'
        : decision === 'changes_requested' ? 'Changes requested'
        : decision === 'rejected' ? 'Listing rejected' : 'Listing review update';
      return { title, label: 'Listings', icon: 'tag', tone: decision === 'rejected' ? 'attention' : 'listing' };
    }
    case 'listing.suspended':
      return { title: 'Listing suspended', label: 'Listings', icon: 'flag', tone: 'attention' };
    case 'affiliation.decision':
      return {
        title: n.payload?.decision === 'verified' ? 'Affiliation verified' : 'Affiliation update',
        label: 'Account', icon: 'shield', tone: 'account',
      };
    default: return { title: 'Marketplace update', label: 'Marketplace', icon: 'bell', tone: 'general' };
  }
}
