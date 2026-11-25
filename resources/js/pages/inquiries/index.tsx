import { BellOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { ConversationSwipeActions } from '@/components/chat/conversation-swipe-actions';
import { MessageReceipt } from '@/components/chat/message-receipt';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen-state';
import { api, explain, timeAgo } from '@/lib/api';
import { listenRealtime, shouldPollRealtime } from '@/lib/realtime';
import { mergeInboxPages, type InboxPage } from '@/lib/messaging/inbox-pages';
import { hasNewIncomingMessage, messageReceiveSoundEnabled, playMessageReceiveSound, prepareMessageReceiveSound, setMessageReceiveSoundEnabled, unlockMessageReceiveSound } from '@/lib/messaging/message-receive-sound';
import { useMe } from '@/providers/session-provider';

export function Inquiries() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [olderError, setOlderError] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderLock = useRef(false);
  const nextCursor = useRef<number | null | undefined>(undefined);
  const [hasOlder, setHasOlder] = useState(false);
  const [receiveSoundOn, setReceiveSoundOn] = useState(messageReceiveSoundEnabled);
  const knownMessageIdsRef = useRef<Set<number>>(new Set());
  const inboxLoadedRef = useRef(false);
  const foregroundRef = useRef(false);
  const requestRef = useRef(0);
  const { me, syncUnread } = useMe();
  const currentUserIdRef = useRef(me?.id);
  currentUserIdRef.current = me?.id;
  // Poll only while this inbox is mounted. Do not sound on first history load,
  // own messages, repeated results, or the first catch-up after backgrounding.
  const load = async () => {
    const request = ++requestRef.current;
    try {
      const page = await api<InboxPage<any>>('/inquiries?limit=30');
      const next = page.items;
      if (request !== requestRef.current) return;
      if (nextCursor.current === undefined) {
        nextCursor.current = page.nextBeforeId;
        setHasOlder(page.hasMore);
      }
      const focused = document.visibilityState === 'visible' && document.hasFocus();
      const latest = next.flatMap(t => t.lastMessage
        ? [{ id: t.lastMessage.id, mine: t.lastMessage.mine }] : []);
      const audible = next.flatMap(t => !t.muted && t.lastMessage
        ? [{ id: t.lastMessage.id, mine: t.lastMessage.mine }] : []);
      if (hasNewIncomingMessage(audible, knownMessageIdsRef.current,
        inboxLoadedRef.current, focused && foregroundRef.current)) playMessageReceiveSound();
      // Muted messages must still be remembered so unmuting never rings for history.
      for (const message of latest) knownMessageIdsRef.current.add(message.id);
      inboxLoadedRef.current = true;
      foregroundRef.current = focused;
      setRows(previous => mergeInboxPages(previous, next)); setError('');
    } catch (e) {
      if (request === requestRef.current) setError(explain(e));
    }
  };
  useEffect(() => {
    if (!me) return;
    knownMessageIdsRef.current.clear();
    nextCursor.current = undefined;
    olderLock.current = false;
    setRows(null);
    setHasOlder(false);
    setOlderError('');
    setLoadingOlder(false);
    inboxLoadedRef.current = false;
    foregroundRef.current = document.visibilityState === 'visible' && document.hasFocus();
    prepareMessageReceiveSound();
    const onBlur = () => { foregroundRef.current = false; };
    const onVisibility = () => { if (document.visibilityState !== 'visible') foregroundRef.current = false; };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    const stopRealtime = listenRealtime(() => void load(), ['chat', 'transaction']);
    let lastPollAt = Date.now();
    const timer = window.setInterval(() => {
      if (!document.hidden && shouldPollRealtime(lastPollAt)) { lastPollAt = Date.now(); void load(); }
    }, 5000);
    return () => {
      requestRef.current++;
      stopRealtime();
      window.clearInterval(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [me?.id]);
  const loadOlder = async () => {
    const beforeId = nextCursor.current;
    if (!beforeId || olderLock.current) return;
    olderLock.current = true;
    setLoadingOlder(true); setOlderError('');
    const userId = me?.id;
    try {
      const page = await api<InboxPage<any>>(`/inquiries?limit=30&beforeId=${beforeId}`);
      if (currentUserIdRef.current !== userId) return;
      setRows(previous => mergeInboxPages(previous, page.items));
      nextCursor.current = page.nextBeforeId;
      setHasOlder(page.hasMore);
    } catch (error) {
      if (currentUserIdRef.current === userId) setOlderError(explain(error));
    } finally {
      olderLock.current = false;
      if (currentUserIdRef.current === userId) setLoadingOlder(false);
    }
  };
  const updateMuted = async (id: number, muted: boolean) => {
    await api(`/inquiries/${id}/preferences`, { method: 'PATCH', body: { muted } });
    setRows(previous => previous?.map(row => row.id === id ? { ...row, muted } : row) ?? null);
    showActionFeedback({ kind: 'success', title: muted ? 'Notifications muted' : 'Notifications enabled',
      message: muted ? 'You will not receive alerts for this conversation.' : 'New messages can notify you again.' });
  };
  const removeFromInbox = async (id: number) => {
    await api(`/inquiries/${id}/hide`, { body: {} });
    setRows(previous => previous?.filter(row => row.id !== id) ?? null);
    void syncUnread();
    showActionFeedback({ kind: 'success', title: 'Removed from inbox',
      message: 'The other student and your transaction records are unaffected.' });
  };
  return <section className="messages-page"
    onPointerDownCapture={() => unlockMessageReceiveSound()}
    onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ') unlockMessageReceiveSound(); }}>
    <div className="page-head messages-heading">
      <div><h1>Messages</h1></div>
      <div className="messages-audio-actions">
        <LegacyButton type="button" className="ghost conversation-sound-toggle"
          aria-label={receiveSoundOn ? 'Sound on — mute incoming message sound' : 'Sound off — enable incoming message sound'}
          aria-pressed={receiveSoundOn}
          onClick={() => {
            const enabled = !receiveSoundOn;
            setReceiveSoundOn(enabled);
            setMessageReceiveSoundEnabled(enabled);
            if (enabled) unlockMessageReceiveSound();
          }}>
          <Icon name="bell" size={17} /> {receiveSoundOn ? 'Sound on' : 'Sound off'}
        </LegacyButton>
        <Link className="btn ghost" to="/explore">Browse listings</Link>
      </div>
    </div>
    {rows === null && !error && <LoadingState>Loading conversations…</LoadingState>}
    {error && rows === null && <ErrorState title="Messages could not load" retry={load} retryText="Try again">{error}</ErrorState>}
    {error && rows !== null && <ErrorState title="Could not refresh messages" retry={load} compact>{error}</ErrorState>}
    {rows?.length === 0 && !error && <EmptyState title="No conversations yet" action={<Link className="btn" to="/explore">Explore listings</Link>}>Explore listings and send a seller a question to start a conversation.</EmptyState>}
    {rows !== null && rows.length > 0 && <div className="inquiry-list">{rows.map(t => <ConversationSwipeActions
      key={t.id} name={t.otherStudentName || 'Student'} muted={Boolean(t.muted)}
      onMute={muted => updateMuted(t.id, muted)} onDelete={() => removeFromInbox(t.id)}>
      <Link to={`/inquiries/${t.id}`}
      className={`inquiry-row${t.unreadCount ? ' is-unread' : ''}`}>
      <span className="avatar" aria-hidden="true">{initials(t.otherStudentName || 'Student')}</span>
      {Boolean(t.unreadCount) && <span className="sr-only">{t.unreadCount} unread messages. </span>}
      <span className="inq-main">
        <span className="inq-top"><strong>{t.otherStudentName || 'Student'}</strong>
          {Boolean(t.muted) && <span className="inquiry-muted-icon" title="Notifications muted"><BellOff size={14} aria-hidden="true" /><span className="sr-only">Notifications muted</span></span>}
          {Boolean(t.unreadCount) && <span className="inquiry-row-unread-dot" aria-hidden="true" />}
          {t.lastMessage && <time dateTime={t.lastMessage.createdAt}>{timeAgo(t.lastMessage.createdAt)}</time>}</span>
        <span className="inq-listing" title={t.listing.title}>About: {t.listing.title}</span>
        <span className="muted inq-preview">{t.lastMessage?.mine ? 'You: ' : ''}{t.lastMessage?.body ?? 'No messages yet.'}</span>
        <span className="inq-details"><span>{t.role === 'buyer' ? 'Buying' : 'Selling'}</span>
          {t.status === 'closed' && <span className="status closed">Closed</span>}
          {t.lastMessage?.mine && <MessageReceipt state={t.lastMessage.receipt ?? 'sent'} compact />}</span>
      </span>
      <span className="inq-open" aria-hidden="true"><Icon name="arrow" size={18} /></span>
    </Link></ConversationSwipeActions>)}</div>}
    {hasOlder && rows !== null && <div className="row" style={{ justifyContent: 'center', padding: '12px' }}>
      <LegacyButton type="button" className="ghost" disabled={loadingOlder}
        onClick={() => void loadOlder()}>{loadingOlder ? 'Loading conversations…' : 'Load older conversations'}</LegacyButton>
    </div>}
    {olderError && <p className="err" role="alert">Could not load older conversations: {olderError}</p>}
  </section>;
}

// First letters of up to two words: "Maria Santos" -> "MS", keeps chat avatars compact.
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
