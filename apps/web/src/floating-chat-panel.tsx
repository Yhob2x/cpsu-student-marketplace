import { FormEvent, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api, explain, timeAgo } from './api';
import { Icon } from './icons';
import { ConversationListingCard, type ConversationListing } from './conversation-listing-card';
import { hasNewIncomingMessage, playMessageReceiveSound, prepareMessageReceiveSound, unlockMessageReceiveSound } from './message-receive-sound';
import { MeetupLocationCard, type MeetupHandoff } from './meetup-location-card';
import { decodeMeetupLocation } from './meetup-location';

type InboxItem = {
  id: number;
  otherStudentName?: string;
  listing: { title: string };
  status: string;
  lastMessage?: { id: number; mine: boolean; body: string; createdAt: string };
};
type ChatMessage = {
  id: number; mine: boolean; body: string; createdAt: string; author?: string;
  seenAt?: string | null; receipt?: string;
};
type Conversation = {
  thread: { id: number; otherStudentName?: string; listingId: number; status: string };
  listing: ConversationListing;
  messages: ChatMessage[];
  handoff?: MeetupHandoff | null;
  transaction?: {
    id: number;
    status: string;
    buyerMeetupConfirmedAt: string | null;
    sellerMeetupConfirmedAt: string | null;
    buyerCompletionConfirmedAt: string | null;
    sellerCompletionConfirmedAt: string | null;
  } | null;
  typing?: boolean;
  otherActiveInChat?: boolean;
};
type Props = {
  onClose: (instant?: boolean) => void;
  onUnreadChanged: () => Promise<void>;
  motionState: 'entering' | 'open' | 'exiting';
  motionEnabled: boolean;
  onExitComplete: () => void;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'S';
}

/** A non-modal quick view. Full-page conversations retain their existing advanced controls. */
export function FloatingChatPanel({ onClose, onUnreadChanged, motionState, motionEnabled, onExitComplete }: Props) {
  const [threadId, setThreadId] = useState<number | null>(null);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [viewMotion, setViewMotion] = useState(false); // The panel itself supplies the initial entrance.
  const [selectedName, setSelectedName] = useState('Student');
  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const latestRef = useRef(true);
  const knownIdsRef = useRef(new Set<number>());
  const initialLoadRef = useRef(false);
  const wasForegroundRef = useRef(false);
  const seenConfirmedRef = useRef(0);
  const seenPendingRef = useRef(0);
  const pingRef = useRef(0);

  useEffect(() => { prepareMessageReceiveSound(); }, []);
  useEffect(() => { titleRef.current?.focus(); }, [threadId]);
  useEffect(() => {
    if (!editing || !window.visualViewport) { setKeyboardOffset(0); setVisibleHeight(0); return; }
    const viewport = window.visualViewport;
    const sync = () => {
      setKeyboardOffset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
      setVisibleHeight(Math.round(viewport.height));
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => { viewport.removeEventListener('resize', sync); viewport.removeEventListener('scroll', sync); };
  }, [editing]);

  useEffect(() => {
    let active = true;
    let issued = 0;
    knownIdsRef.current.clear();
    initialLoadRef.current = false;
    wasForegroundRef.current = document.visibilityState === 'visible' && document.hasFocus();
    seenConfirmedRef.current = 0;
    seenPendingRef.current = 0;
    latestRef.current = true;
    setLoadError('');
    setSendError('');
    setDraft('');
    setEditing(false);
    setMeetupOpen(false);
    if (threadId !== null) setConversation(null);

    const refresh = async () => {
      const request = ++issued;
      try {
        if (threadId === null) {
          const rows = await api<InboxItem[]>('/inquiries');
          if (!active || request !== issued) return;
          const foreground = document.visibilityState === 'visible' && document.hasFocus();
          const latest = rows.flatMap(item => item.lastMessage
            ? [{ id: item.lastMessage.id, mine: item.lastMessage.mine }] : []);
          if (hasNewIncomingMessage(latest, knownIdsRef.current,
            initialLoadRef.current, foreground && wasForegroundRef.current)) playMessageReceiveSound();
          latest.forEach(message => knownIdsRef.current.add(message.id));
          initialLoadRef.current = true;
          wasForegroundRef.current = foreground;
          setInbox(rows);
        } else {
          const next = await api<Conversation>(`/inquiries/${threadId}/messages`);
          if (!active || request !== issued) return;
          const foreground = document.visibilityState === 'visible' && document.hasFocus();
          if (hasNewIncomingMessage(next.messages, knownIdsRef.current,
            initialLoadRef.current, foreground && wasForegroundRef.current)) playMessageReceiveSound();
          next.messages.forEach(message => knownIdsRef.current.add(message.id));
          initialLoadRef.current = true;
          wasForegroundRef.current = foreground;
          setConversation(next);
        }
        setLoadError('');
      } catch (error) {
        if (active && request === issued) setLoadError(error instanceof ApiError && error.status >= 500
          ? 'Messages are temporarily unavailable. Check your connection and try again.' : explain(error));
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, threadId === null ? 5000 : 3000);
    return () => { active = false; ++issued; window.clearInterval(timer); refreshRef.current = async () => {}; };
  }, [threadId]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && latestRef.current) log.scrollTop = log.scrollHeight;
  }, [conversation?.thread.id, conversation?.messages.length, conversation?.typing]);

  // Acknowledge only incoming messages that are at least half visible in the open quick view.
  useEffect(() => {
    const log = logRef.current;
    if (!log || !conversation || threadId === null) return;
    let active = true;
    const checkVisible = () => {
      if (!active || document.hidden || !document.hasFocus()) return;
      const viewport = log.getBoundingClientRect();
      let highest = 0;
      for (const row of log.querySelectorAll<HTMLElement>('[data-incoming-id]')) {
        const bounds = row.getBoundingClientRect();
        const visible = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
        if (visible >= bounds.height * 0.5) highest = Math.max(highest, Number(row.dataset.incomingId));
      }
      if (!highest || highest <= seenConfirmedRef.current || highest <= seenPendingRef.current) return;
      seenPendingRef.current = highest;
      void api(`/inquiries/${threadId}/seen`, { body: { upToId: highest } })
        .then(() => {
          if (active) {
            seenConfirmedRef.current = Math.max(seenConfirmedRef.current, highest);
            void onUnreadChanged();
          }
        })
        .catch(() => { /* Leave unread until a subsequent visibility check succeeds. */ })
        .finally(() => { if (seenPendingRef.current === highest) seenPendingRef.current = 0; });
    };
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(checkVisible, { root: log, threshold: [0, .5, 1] }) : null;
    log.querySelectorAll<HTMLElement>('[data-incoming-id]').forEach(el => observer?.observe(el));
    log.addEventListener('scroll', checkVisible);
    window.addEventListener('focus', checkVisible);
    document.addEventListener('visibilitychange', checkVisible);
    checkVisible();
    return () => {
      active = false;
      observer?.disconnect();
      log.removeEventListener('scroll', checkVisible);
      window.removeEventListener('focus', checkVisible);
      document.removeEventListener('visibilitychange', checkVisible);
    };
  }, [threadId, conversation?.messages]);

  const send = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || !conversation || threadId === null || conversation.thread.status === 'closed' || sending) return;
    setSending(true);
    setSendError('');
    try {
      await api(`/inquiries/${threadId}/messages`, { body: { body: message } });
      setDraft('');
      latestRef.current = true;
      await refreshRef.current();
    } catch (error) {
      setSendError(explain(error));
    } finally { setSending(false); }
  };
  const pingTyping = () => {
    if (threadId === null || conversation?.thread.status === 'closed') return;
    if (Date.now() - pingRef.current < 2000) return;
    pingRef.current = Date.now();
    void api(`/inquiries/${threadId}/typing`, { body: {} }).catch(() => {});
  };
  const threadName = conversation?.thread.otherStudentName || selectedName;
  const closed = conversation?.thread.status === 'closed';
  const transaction = conversation?.transaction;
  const shareableTransaction = transaction && ['accepted', 'negotiating', 'for_meetup'].includes(transaction.status);
  const requiresReconfirmation = transaction?.status === 'for_meetup' ||
    Boolean(transaction?.buyerMeetupConfirmedAt || transaction?.sellerMeetupConfirmedAt);
  const locationEditable = Boolean(conversation && !closed && (
    !transaction || (shareableTransaction && !transaction.buyerCompletionConfirmedAt
      && !transaction.sellerCompletionConfirmedAt)
  ));
  const meeting = decodeMeetupLocation(conversation?.handoff?.generalLocation ?? '');
  const style = {
    '--floating-chat-keyboard-offset': `${keyboardOffset}px`,
    '--floating-chat-viewport-height': visibleHeight ? `${visibleHeight}px` : '100dvh',
  } as CSSProperties;
  return <section id="floating-chat-panel" className="floating-chat-panel" role="dialog" aria-modal="false"
    aria-hidden={motionState === 'exiting' ? true : undefined}
    data-motion-state={motionState}
    data-motion={motionEnabled ? 'on' : 'off'}
    data-view-motion={viewMotion && motionEnabled ? 'on' : 'off'}
    onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === 'opacity' && motionState === 'exiting') onExitComplete();
    }}
    data-keyboard-open={editing && keyboardOffset > 100 ? "true" : "false"}
    aria-label="Messages quick view" style={style}
    onPointerDownCapture={unlockMessageReceiveSound}>
    <header className="floating-chat-panel-head">
      {threadId !== null && <button type="button" className="floating-chat-icon-button"
        aria-label="Back to conversations" onClick={event => { setViewMotion(event.detail !== 0); setThreadId(null); }}>
        <Icon name="chevronLeft" size={20} /></button>}
      <h2 ref={titleRef} key={threadId ?? 'inbox'} tabIndex={-1}>{threadId === null ? 'Messages' : threadName}</h2>
      <button type="button" className="floating-chat-icon-button floating-chat-close" aria-label="Close chat"
        onClick={event => onClose(event.detail === 0)}>×</button>
    </header>
    {threadId === null ? <>
      <div className="floating-chat-panel-body" aria-label="Conversation list">
        {inbox === null && !loadError && <p className="muted" role="status">Loading conversations…</p>}
        {loadError && <div className="floating-chat-feedback" role="alert"><p>{loadError}</p>
          <button type="button" className="btn ghost" onClick={() => void refreshRef.current()}>Retry</button></div>}
        {inbox?.length === 0 && !loadError && <div className="floating-chat-empty">
          <Icon name="chat" size={27} /><strong>No conversations yet</strong>
          <p>Explore a listing and ask its seller a question to start chatting.</p>
          <Link to="/explore" onClick={() => onClose(true)}>Explore listings</Link>
        </div>}
        {inbox?.map(item => <button type="button" className="floating-chat-inbox-row" key={item.id}
          onClick={event => { setViewMotion(event.detail !== 0); setSelectedName(item.otherStudentName || 'Student'); setThreadId(item.id); latestRef.current = true; }}>
          <span className="floating-chat-avatar" aria-hidden="true">{initials(item.otherStudentName || 'Student')}</span>
          <span className="floating-chat-inbox-copy">
            <span className="floating-chat-inbox-top"><strong>{item.otherStudentName || 'Student'}</strong>
              {item.lastMessage && <time dateTime={item.lastMessage.createdAt}>{timeAgo(item.lastMessage.createdAt)}</time>}</span>
            <span className="floating-chat-item-listing">{item.listing?.title ?? 'Marketplace listing'}</span>
            <span className="floating-chat-message-preview">{item.lastMessage?.mine ? 'You: ' : ''}{item.lastMessage?.body ?? 'No messages yet.'}</span>
          </span>
        </button>)}
      </div>
      <div className="floating-chat-panel-foot"><Link to="/inquiries" onClick={() => onClose(true)}>Open all messages <Icon name="arrow" size={15} /></Link></div>
    </> : <>
      <div className="floating-chat-thread-context">
        <span>{conversation?.otherActiveInChat ? '● Active in chat' : closed ? 'Conversation closed' : 'Conversation'}</span>
        <span>Listing conversation</span>
      </div>
      {conversation?.listing && <div className="floating-chat-product" aria-label="Product or service being discussed">
        <ConversationListingCard key={conversation.listing.id} listing={conversation.listing} compact onNavigate={() => onClose(true)} />
      </div>}
      <div className="floating-chat-message-log" role="log" tabIndex={0} aria-label="Conversation messages"
        ref={logRef} onScroll={event => {
          const el = event.currentTarget;
          latestRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
        }}>
        {!conversation && !loadError && <p role="status" className="muted">Loading messages…</p>}
        {loadError && <div className="floating-chat-feedback" role="alert"><p>{loadError}</p>
          <button type="button" className="btn ghost" onClick={() => void refreshRef.current()}>Retry</button></div>}
        {conversation?.messages.length === 0 && <p className="muted">No messages yet. Say hello.</p>}
        {conversation?.messages.map(message => <div key={message.id}
          className={`floating-chat-message ${message.mine ? 'mine' : 'theirs'}`}
          data-incoming-id={!message.mine && !message.seenAt ? message.id : undefined}>
          <span className="floating-chat-bubble">{message.body}</span>
          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</time>
        </div>)}
      </div>
      {conversation && <div className="floating-chat-meetup-strip">
        <span className="floating-chat-meetup-label">
          <Icon name="pin" size={16} />
          <span>{meeting.point ? meeting.place || 'Meetup pin shared' : 'Meetup location'}</span>
        </span>
        <button type="button" className="floating-chat-meetup-toggle"
          aria-expanded={meetupOpen} aria-controls="floating-chat-meetup-sheet"
          onClick={() => setMeetupOpen(value => !value)}>
          {meeting.point ? 'View map' : 'Add pin'}
        </button>
      </div>}
      {conversation?.typing && !closed && <p className="floating-chat-typing" role="status">{threadName} is typing…</p>}
      {closed && <p className="floating-chat-closed" role="status">This conversation has ended.</p>}
      {!closed && <form className="floating-chat-compose" onSubmit={event => void send(event)}>
        <label htmlFor="floating-chat-reply" className="sr-only">Your message</label>
        <textarea id="floating-chat-reply" rows={1} maxLength={1000} enterKeyHint="send"
          value={draft} disabled={sending || !conversation} placeholder="Write a message…"
          onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
          onChange={event => { setDraft(event.target.value); pingTyping(); }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault(); void send();
            }
          }} />
        <button type="submit" className="floating-chat-send" disabled={sending || !draft.trim() || !conversation}
          aria-label={sending ? 'Sending message' : 'Send message'}><Icon name="arrow" size={18} /></button>
      </form>}
      {sendError && <p className="floating-chat-compose-error" role="alert">{sendError}</p>}
      {conversation && meetupOpen && <div className="floating-chat-meetup-sheet" id="floating-chat-meetup-sheet">
        <div className="floating-chat-meetup-sheet-head">
          <strong>Meetup map</strong>
          <button type="button" className="btn ghost" onClick={() => setMeetupOpen(false)}
            aria-label="Close meetup map">Close</button>
        </div>
        <MeetupLocationCard key={conversation.thread.id}
          inquiryThreadId={conversation.thread.id}
          transactionId={transaction?.id}
          handoff={conversation.handoff ?? null}
          editable={locationEditable}
          requiresReconfirmation={requiresReconfirmation}
          unavailableReason={closed ? 'This conversation has ended. The meetup is read-only.'
            : transaction?.status === 'pending'
              ? 'The seller must accept the purchase request before a meetup pin can be saved.'
              : 'This transaction is closed or completion has begun.'}
          compact onSaved={() => refreshRef.current()} />
        {transaction && <Link to={`/transactions/${transaction.id}`}
          onClick={() => onClose(true)} className="floating-chat-meetup-transaction">
          View transaction and confirm meetup
        </Link>}
      </div>}
      <div className="floating-chat-panel-foot"><Link to={`/inquiries/${threadId}`} onClick={() => onClose(true)}>
        Open full conversation <Icon name="arrow" size={15} /></Link></div>
    </>}
  </section>;
}
