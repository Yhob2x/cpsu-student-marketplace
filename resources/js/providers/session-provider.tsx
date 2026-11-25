import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { showActionFeedback } from '@/components/action-feedback';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { connectRealtime } from '@/lib/realtime';
import { api, setToken, tryRestoreSession } from '@/lib/api';
import { withSavedListing } from '@/lib/listings/saved-state';
import { disconnectPushOnLogout, reconcilePushForActiveAccount, updateAppBadge } from '@/lib/push/push-client';
import type { Me } from '@/types/session';

export type { Me } from '@/types/session';

export type Session = {
  me: Me | null; reload: () => Promise<Me | null>; logout: () => Promise<void>; ready: boolean;
  unread: number; syncUnread: () => Promise<void>;
  queue: number; syncQueue: (known?: number) => Promise<void>;
  savedIds: number[]; pendingSavedIds: number[]; toggleSaved: (id: number, saved: boolean) => Promise<boolean>;
  unreadMessages: number; loggingOut: boolean; logoutError: string;
  isStaff: boolean | undefined; isReviewer: boolean | undefined; signedOut: boolean;
};

const STAFF_ROLES = ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'];
const REVIEWER_ROLES = ['campus_reviewer', 'university_admin'];

const SessionContext = createContext<Session>(null!);
export const useMe = () => useContext(SessionContext);

/** Owns the signed-in account and the counters, saved listings and push state that follow it. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [queue, setQueue] = useState(0);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [pendingSavedIds, setPendingSavedIds] = useState<number[]>([]);
  const savedPending = useRef(new Set<number>());
  const savedRevision = useRef(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const logoutLock = useRef(false);

  const reload = async () => { try { const current = await api<Me>('/me'); setMe(prev => JSON.stringify(prev) === JSON.stringify(current) ? prev : current); return current; } catch { setMe(null); return null; } };
  const syncUnread = async () => {
    try {
      const counts = await api<{ total: number; messages: number }>('/notifications/unread-count');
      setUnread(counts.total);
      setUnreadMessages(counts.messages);
    } catch { /* keep the previous count rather than flashing zero */ }
  };

  useEffect(() => { (async () => { if (await tryRestoreSession()) await reload(); setReady(true); })(); }, []);
  const isStaff = me?.roles.some(r => STAFF_ROLES.includes(r.role));
  // One shared source of saved-listing ids keeps cards and the listing page in sync.
  const syncSaved = async () => {
    if (isStaff) { setSavedIds([]); return; }
    const before = savedRevision.current;
    try {
      const rows = await api<{ id: number }[]>('/saved');
      // A delayed initial fetch must not undo a newer local user action.
      if (before === savedRevision.current) setSavedIds(rows.map(r => r.id));
    } catch { /* keep previous */ }
  };
  const toggleSaved = async (id: number, saved: boolean) => {
    if (isStaff || !me || savedPending.current.has(id)) return false;
    savedPending.current.add(id);
    setPendingSavedIds(previous => withSavedListing(previous, id, true));
    savedRevision.current++;
    // Update the saved state immediately; only confirm success after server acknowledgement.
    setSavedIds(previous => withSavedListing(previous, id, saved));
    try {
      await api(`/saved/${id}`, { method: saved ? 'PUT' : 'DELETE' });
      showActionFeedback({ kind: 'success', title: saved ? 'Listing saved' : 'Listing removed', message: saved ? 'You can find it in Saved items.' : 'Removed from your saved items.' });
      return true;
    } catch {
      // Keep other cards' saves intact; rollback this listing alone.
      savedRevision.current++;
      setSavedIds(previous => withSavedListing(previous, id, !saved));
      showActionFeedback({ kind: 'error', title: 'Save not synced', message: 'Your previous saved state was restored. Check your connection and retry.' });
      return false;
    } finally {
      savedPending.current.delete(id);
      setPendingSavedIds(previous => withSavedListing(previous, id, false));
    }
  };
  const isReviewer = me?.roles.some(r => REVIEWER_ROLES.includes(r.role));
  const usesCampusQueueBadge = isReviewer && !me?.roles.some(r => r.role === 'university_admin' && r.campusId === null);
  // Pending affiliations plus listings, so reviewers see the queue depth before opening it.
  const syncQueue = async (known?: number) => {
    if (!usesCampusQueueBadge) return;
    if (known !== undefined) { setQueue(known); return; }
    try {
      const r = await api<{ listings: unknown[]; affiliations: unknown[]; reportsPending?: number }>('/admin/review-queue');
      setQueue(r.listings.length + r.affiliations.length + (r.reportsPending ?? 0));
    } catch { /* keep the previous count */ }
  };
  useEffect(() => {
    if (!me) { savedRevision.current++; savedPending.current.clear(); setPendingSavedIds([]); setUnread(0); setUnreadMessages(0); setSavedIds([]); setQueue(0); return; }
    syncUnread(); syncSaved(); if (usesCampusQueueBadge) syncQueue(); else setQueue(0);
  }, [me]);

  // On login/account switching, detach old browser subscriptions rather than
  // showing one student's push alerts while another student is using the device.
  useEffect(() => {
    if (!me) return;
    let active = true;
    void reconcilePushForActiveAccount(() => active).catch(() => {
      // Keep in-app notifications available when the enrollment API is offline.
    });
    return () => { active = false; };
  }, [me?.id]);

  // Do not claim to have signed out when server-side session revocation fails.
  // Keep the account visible, explain the failure, and allow a retry.
  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true; setLoggingOut(true); setLogoutError('');
    try {
      const pushEndpoint = await disconnectPushOnLogout();
      // Session-authenticated fallback removes this device's subscription even if
      // the separate push DELETE failed; other signed-in devices stay enrolled.
      await api('/auth/logout', { method: 'POST', body: { pushEndpoint } });
      setToken(null); setMe(null);
      showActionFeedback({ kind: 'success', title: 'Signed out', message: 'You have safely signed out of CPSU Market.' });
    } catch {
      setLogoutError('Could not sign out. Check your connection and try again. Your session may still be active.');
      showActionFeedback({ kind: 'error', title: 'Sign-out failed', message: 'Your session may still be active. Please try again.' });
    } finally {
      logoutLock.current = false; setLoggingOut(false);
    }
  };
  useEffect(() => { void updateAppBadge(me ? unread : null); }, [me?.id, unread]);
  // Keep unread messages, followed-store alerts and review/report counts current.
  useForegroundRefresh(async () => {
    await syncUnread();
    if (usesCampusQueueBadge) await syncQueue();
  }, 5_000, Boolean(me));
  // Affiliation decisions also update the profile and seller permissions without navigation.
  useForegroundRefresh(async () => {
    try {
      const current = await api<Me>('/me');
      setMe(prev => JSON.stringify(prev) === JSON.stringify(current) ? prev : current);
    } catch { /* transient network failures must not sign the user out */ }
  }, 15_000, Boolean(me));
  useEffect(() => {
    if (!me) return;
    const onPush = (event: MessageEvent) => {
      if (event.data?.type === 'CPSU_PUSH_RECEIVED') void syncUnread();
    };
    navigator.serviceWorker?.addEventListener('message', onPush);
    return () => navigator.serviceWorker?.removeEventListener('message', onPush);
  }, [me?.id]);
  useEffect(() => me ? connectRealtime(me.id) : undefined, [me?.id]);
  const signedOut = ready && !me;

  return (
    <SessionContext.Provider value={{ me, reload, logout, ready, unread, syncUnread, queue, syncQueue, savedIds, pendingSavedIds, toggleSaved,
      unreadMessages, loggingOut, logoutError, isStaff, isReviewer, signedOut }}>
      {children}
    </SessionContext.Provider>
  );
}
