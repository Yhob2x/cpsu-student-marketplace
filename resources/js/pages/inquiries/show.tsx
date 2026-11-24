import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ConversationListingCard } from '@/components/chat/conversation-listing-card';
import { MessageReceipt } from '@/components/chat/message-receipt';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Panel } from '@/components/ui/primitives';
import { api, explain } from '@/lib/api';
import { decodeMeetupLocation, openStreetMapPinUrl } from '@/lib/meetup/meetup-location';
import { mergeMessageHistory } from '@/lib/messaging/message-history';
import { hasNewIncomingMessage, messageReceiveSoundEnabled, playMessageReceiveSound, prepareMessageReceiveSound, setMessageReceiveSoundEnabled, unlockMessageReceiveSound } from '@/lib/messaging/message-receive-sound';
import { useMe } from '@/providers/session-provider';

function HandoffPlace({ location }: { location: string }) {
  const { place, point } = decodeMeetupLocation(location);
  return <>{place}{point && <> · <a href={openStreetMapPinUrl(point)} target="_blank"
    rel="noopener noreferrer">Open meetup map</a></>}</>;
}

function messageDayKey(iso: string) { return new Date(iso).toDateString(); }

function messageDayLabel(iso: string) {
  const day = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return 'Today';
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return day.toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' as const } : {}),
  });
}

export function Thread() {
  const { id } = useParams();
  const activeRouteRef = useRef(id);
  activeRouteRef.current = id;
  const { syncUnread } = useMe();
  const [d, setD] = useState<any>(null);
  const messageIdsRef = useRef<Set<number>>(new Set());
  const newlyArrivedRef = useRef<Set<number>>(new Set());
  const firstFetchRef = useRef(false);
  const seenConfirmedRef = useRef(0);
  const seenPendingRef = useRef(0);
  const [body, setBody] = useState('');
  const [loadError, setLoadError] = useState('');
  const [earlierError, setEarlierError] = useState('');
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const earlierPendingRef = useRef(false);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);
  const [sendError, setSendError] = useState('');
  const [busy, setBusy] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);
  const [safetyError, setSafetyError] = useState('');
  const [safetyNotice, setSafetyNotice] = useState('');
  const closeLock = useRef(false);
  const [receiveSoundOn, setReceiveSoundOn] = useState(messageReceiveSoundEnabled);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const lastPing = useRef(0);
  const pageRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const syncKeyboardRef = useRef<() => void>(() => {});

  useEffect(() => { prepareMessageReceiveSound(); }, []);

  // On phones whose keyboard overlays (rather than resizes) the layout viewport,
  // reserve scroll space and bring the reply field above the visible keyboard.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const editing = document.activeElement?.id === 'conversation-reply';
      const keyboardSpace = editing ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      pageRef.current?.style.setProperty('--chat-keyboard-space', `${Math.round(keyboardSpace)}px`);
      // On mobile, fit the entire conversation into the visible viewport when
      // Safari overlays the keyboard. Never rely on scrolling the whole page.
      if (window.matchMedia('(max-width: 860px)').matches) {
        if (editing && keyboardSpace > 100) {
          document.body.style.setProperty('--chat-visible-height', `${Math.round(viewport.height)}px`);
        } else {
          document.body.style.removeProperty('--chat-visible-height');
        }
      } else if (editing && keyboardSpace > 100 && composerRef.current) {
        const bottom = composerRef.current.getBoundingClientRect().bottom;
        const visibleBottom = viewport.offsetTop + viewport.height;
        if (bottom > visibleBottom - 8) window.scrollBy({ top: Math.ceil(bottom - visibleBottom + 12), behavior: 'auto' });
      }
    };
    syncKeyboardRef.current = sync;
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      document.body.style.removeProperty('--chat-visible-height');
      syncKeyboardRef.current = () => {};
    };
  }, []);

  useEffect(() => {
    let active = true;
    let newestRequest = 0;
    // Suppress catch-up ringing on first focus after the chat was backgrounded.
    let continuouslyForeground = document.visibilityState === 'visible' && document.hasFocus();
    const onBlur = () => { continuouslyForeground = false; };
    const onVisibility = () => { if (document.visibilityState !== 'visible') continuouslyForeground = false; };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    followLatest.current = true;
    firstFetchRef.current = false;
    messageIdsRef.current.clear();
    newlyArrivedRef.current.clear();
    seenConfirmedRef.current = 0;
    seenPendingRef.current = 0;
    setD(null); setLoadError(''); setEarlierError(''); setLoadingEarlier(false);
    earlierPendingRef.current = false;
    prependAnchorRef.current = null;
    setSendError(''); setBody('');
    setCloseConfirm(false); setSafetyError(''); setSafetyNotice('');
    const refresh = async () => {
      const request = ++newestRequest;
      try {
        const next = await api(`/inquiries/${id}/messages?limit=50`);
        if (active && request === newestRequest) {
          // Only NEW incoming messages ring: never the first history load,
          // outgoing sends, repeated polls, or background/refocus catch-up.
          const focused = document.visibilityState === 'visible' && document.hasFocus();
          if (!next.muted && hasNewIncomingMessage(next.messages, messageIdsRef.current,
            firstFetchRef.current, focused && continuouslyForeground)) playMessageReceiveSound();
          continuouslyForeground = focused;
          // Animate only messages arriving after the first history load.
          for (const message of next.messages) {
            if (firstFetchRef.current && !messageIdsRef.current.has(message.id)) newlyArrivedRef.current.add(message.id);
            messageIdsRef.current.add(message.id);
          }
          firstFetchRef.current = true;
          setD((prev: any) => prev?.thread?.id === next.thread.id ? {
            ...next,
            messages: mergeMessageHistory(prev.messages, next.messages),
            // A periodic recent-window poll must not hide previously loaded pages.
            hasEarlier: prev.hasEarlier,
          } : next);
          setLoadError('');
        }
      } catch (e) {
        if (active && request === newestRequest) setLoadError(explain(e));
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 3000);
    return () => {
      active = false; newestRequest++; clearInterval(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      refreshRef.current = async () => {};
    };
  }, [id]);

  // Foreground chat presence only. A background or unfocused tab never sends a heartbeat.
  // The API expires presence after 25 seconds, and only this conversation's participants can see it.
  useEffect(() => {
    if (!id || !d?.thread?.id || d.thread.status === 'closed') return;
    let active = true;
    const heartbeat = async () => {
      if (!active || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      try {
        await api(`/inquiries/${id}/presence`, { body: {} });
        if (active) void refreshRef.current();
      } catch { /* No false online state is produced if the heartbeat fails. */ }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 10000);
    window.addEventListener('focus', heartbeat);
    document.addEventListener('visibilitychange', heartbeat);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', heartbeat);
      document.removeEventListener('visibilitychange', heartbeat);
    };
  }, [id, d?.thread?.id, d?.thread?.status]);

  // Follow the newest message AND typing state only while the student is at
  // the latest end of the chat; never pull them away from older messages.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (prependAnchorRef.current) {
      const { height, top } = prependAnchorRef.current;
      log.scrollTop = log.scrollHeight - height + top;
      prependAnchorRef.current = null;
    } else if (followLatest.current) {
      log.scrollTop = log.scrollHeight;
    }
  }, [d?.thread?.id, d?.messages?.length, d?.typing]);

  // Keyboard, browser chrome and device rotation can change the log height
  // without adding a message. Keep the latest row anchored unless reading back.
  useEffect(() => {
    const log = logRef.current;
    if (!log || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followLatest.current) log.scrollTop = log.scrollHeight;
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [d?.thread?.id]);

  // Read receipts are only acknowledged for incoming messages at least half visible
  // in the active conversation. Scrolling never marks messages farther down as read.
  useEffect(() => {
    const log = logRef.current;
    if (!log || !d || !id) return;
    let active = true;
    const checkVisible = () => {
      if (!active || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      const viewport = log.getBoundingClientRect();
      let highest = 0;
      for (const row of log.querySelectorAll<HTMLElement>('[data-incoming-id]')) {
        const messageId = Number(row.dataset.incomingId);
        const bounds = row.getBoundingClientRect();
        const intersection = Math.max(0, Math.min(bounds.bottom, viewport.bottom) - Math.max(bounds.top, viewport.top));
        if (intersection >= bounds.height * 0.5) highest = Math.max(highest, messageId);
      }
      if (!highest || highest <= seenConfirmedRef.current || highest <= seenPendingRef.current) return;
      seenPendingRef.current = highest;
      void api(`/inquiries/${id}/seen`, { body: { upToId: highest } })
        .then(() => {
          if (!active) return;
          seenConfirmedRef.current = Math.max(seenConfirmedRef.current, highest);
          void syncUnread();
          const seenAt = new Date().toISOString();
          setD((prev: any) => prev?.thread?.id === Number(id) ? {
            ...prev, messages: prev.messages.map((m: any) =>
              !m.mine && m.id <= highest ? { ...m, seenAt, receipt: 'read' } : m),
          } : prev);
        })
        .catch(() => { /* Retry when messages refresh or the recipient returns to the tab. */ })
        .finally(() => {
          // A poll can replace this observer while the acknowledgment is in flight.
          // Always release its pending watermark so later visible messages can be acknowledged.
          if (seenPendingRef.current === highest) seenPendingRef.current = 0;
        });
    };
    const observer = new IntersectionObserver(checkVisible, { root: log, threshold: [0, 0.5, 1] });
    log.querySelectorAll<HTMLElement>('[data-incoming-id]').forEach(row => observer.observe(row));
    document.addEventListener('visibilitychange', checkVisible);
    window.addEventListener('focus', checkVisible);
    checkVisible();
    return () => {
      active = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', checkVisible);
      window.removeEventListener('focus', checkVisible);
    };
  }, [id, d?.messages]);

  const loadEarlier = async () => {
    const oldestId = d?.messages?.[0]?.id;
    const threadId = d?.thread?.id;
    const routeAtStart = activeRouteRef.current;
    if (!d?.hasEarlier || !oldestId || !threadId || earlierPendingRef.current) return;
    earlierPendingRef.current = true;
    setLoadingEarlier(true);
    setEarlierError('');
    try {
      const page = await api(`/inquiries/${threadId}/messages?limit=50&beforeId=${oldestId}`);
      if (activeRouteRef.current !== routeAtStart) return;
      if (page.messages.length) {
        const log = logRef.current;
        if (log) prependAnchorRef.current = { height: log.scrollHeight, top: log.scrollTop };
        followLatest.current = false;
      }
      setD((prev: any) => prev?.thread?.id === threadId ? {
        ...prev,
        messages: mergeMessageHistory(page.messages, prev.messages),
        hasEarlier: page.hasEarlier,
      } : prev);
    } catch (error) {
      if (activeRouteRef.current === routeAtStart) setEarlierError(explain(error));
    } finally {
      if (activeRouteRef.current === routeAtStart) {
        earlierPendingRef.current = false;
        setLoadingEarlier(false);
      }
    }
  };

  const closeConversation = async () => {
    if (closeLock.current || busy || !d || d.thread.status === 'closed') return;
    closeLock.current = true; setClosing(true); setSafetyError(''); setSafetyNotice('');
    try {
      await api(`/inquiries/${id}/close`, { body: {} });
      // Immediately remove the composer; the next refresh confirms server state.
      setD((prev: any) => prev?.thread?.id === Number(id)
        ? { ...prev, thread: { ...prev.thread, status: 'closed' }, typing: false }
        : prev);
      setCloseConfirm(false);
      setSafetyNotice('Conversation ended. Previous messages remain available.');
      await refreshRef.current();
    } catch (e) { setSafetyError(explain(e)); }
    finally { closeLock.current = false; setClosing(false); }
  };

  const send = async () => {
    const message = body.trim();
    if (busy || closing || closeConfirm || !message || !d || d.thread.status === 'closed') return;
    // Sending a message must be silent. Only newly received messages ring.
    setBusy(true); setSendError('');
    try {
      await api(`/inquiries/${id}/messages`, { body: { body: message } });
      setBody('');
      followLatest.current = true;
      await refreshRef.current();
    } catch (e) { setSendError(explain(e)); }
    finally { setBusy(false); }
  };
  const ping = () => {
    if (!d || d.thread.status === 'closed') return;
    const now = Date.now();
    if (now - lastPing.current < 2000) return;
    lastPing.current = now;
    api(`/inquiries/${id}/typing`, { body: {} }).catch(() => {});
  };

  if (loadError && !d) return <section className="conversation-page">
    <Link to="/inquiries" className="conversation-back">Back to messages</Link>
    <div className="empty" role="alert"><h1>Conversation unavailable</h1><p className="muted">{loadError}</p>
      <LegacyButton className="" type="button" onClick={() => void refreshRef.current()}>Try again</LegacyButton></div>
  </section>;
  if (!d) return <p className="muted" role="status">Loading conversation…</p>;

  const closed = d.thread.status === 'closed';
  const lastMineId = [...d.messages].reverse().find((m: any) => m.mine)?.id;
  const otherStudentName = d.thread.otherStudentName || 'Other student';
  return <section className="conversation-page" ref={pageRef}
    onPointerDownCapture={() => unlockMessageReceiveSound()}
    onKeyDownCapture={e => { if (e.key === 'Enter' || e.key === ' ') unlockMessageReceiveSound(); }}>
    <Link to="/inquiries" className="conversation-back">← Back to messages</Link>
    <div className={`conversation-heading ${closed ? 'is-closed' : ''}`}>
      <div className="conversation-heading-info">
        <h1>{otherStudentName}</h1>
        {!closed && <p className={`conversation-presence ${d.otherActiveInChat ? 'is-online' : ''}`}
          role="status" aria-label={d.otherActiveInChat ? `${otherStudentName} active in this chat` : `${otherStudentName} not currently active in this chat`}>
          <span className="presence-dot" aria-hidden="true" />
          {d.otherActiveInChat ? 'Online' : 'Not active in chat'}
        </p>}
      </div>
      <div className="conversation-actions">
        {!closed && <LegacyButton type="button" className="ghost conversation-sound-toggle"
          aria-pressed={receiveSoundOn} aria-label={receiveSoundOn ? 'Sound on — mute incoming message sound' : 'Sound off — enable incoming message sound'}
          onClick={() => { const enabled = !receiveSoundOn; setReceiveSoundOn(enabled); setMessageReceiveSoundEnabled(enabled); if (enabled) unlockMessageReceiveSound(); }}>
          <Icon name="bell" size={17} /> {receiveSoundOn ? 'Sound on' : 'Sound off'}
        </LegacyButton>}
        {closed && <span className="status closed">Closed</span>}
        {!closed && <LegacyButton type="button" className="ghost" disabled={closing || busy}
          aria-label="End conversation" aria-expanded={closeConfirm} onClick={() => { setCloseConfirm(open => !open); setSafetyError(''); }}>
          End chat
        </LegacyButton>}
        <Link className="btn ghost" to={`/listings/${d.thread.listingId}`}>View listing <Icon name="arrow" size={16} /></Link>
      </div>
    </div>
    {closeConfirm && !closed && <Panel className="stack" role="group" aria-label="End conversation confirmation">
      <h2>End this conversation for both students?</h2>
      <p className="muted">Neither of you can send more messages in this listing's conversation. Previous messages stay readable. This does not block the student on other listings or cancel any transaction.</p>
      <div className="row"><LegacyButton type="button" className="danger" disabled={closing || busy}
        onClick={() => void closeConversation()}>{closing ? 'Ending…' : 'Yes, end conversation'}</LegacyButton>
        <LegacyButton type="button" className="ghost" disabled={closing} onClick={() => setCloseConfirm(false)}>Keep chatting</LegacyButton></div>
    </Panel>}
    {safetyError && <p className="err" role="alert">Could not end conversation: {safetyError}</p>}
    {safetyNotice && <p role="status">{safetyNotice}</p>}
    {loadError && <p className="err" role="alert">Could not refresh messages: {loadError}</p>}
    <div className="thread-scroll conversation-log" ref={logRef} role="log" tabIndex={0} aria-label="Conversation messages" aria-live="polite"
      onScroll={e => { const el = e.currentTarget; followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
      {d.hasEarlier && <div className="row" style={{ justifyContent: 'center', padding: '8px 12px' }}>
        <LegacyButton type="button" className="ghost" disabled={loadingEarlier}
          onClick={() => void loadEarlier()} aria-label="Load earlier conversation messages">
          {loadingEarlier ? 'Loading earlier messages…' : 'Load earlier messages'}
        </LegacyButton>
      </div>}
      {earlierError && <p role="alert" className="err">Could not load earlier messages: {earlierError}</p>}
      {d.messages.length > 0 && <div className="message-day-divider"><span>{messageDayLabel(d.messages[0].createdAt)}</span></div>}
      {d.listing && <ConversationListingCard key={d.listing.id} listing={d.listing} />}
      {d.messages.length === 0 && <p className="muted">No messages yet. Start by asking a question about the listing.</p>}
      {d.messages.map((m: any, i: number) => {
        const before = d.messages[i - 1];
        const showDay = !!before && messageDayKey(before.createdAt) !== messageDayKey(m.createdAt);
        const grouped = !!before && before.mine === m.mine && !showDay;
        const showLastTime = i === d.messages.length - 1;
        const fullStamp = new Date(m.createdAt).toLocaleString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        });
        return <div className="message-segment" key={m.id}>
          {showDay && <div className="message-day-divider">
            <span>{messageDayLabel(m.createdAt)}</span></div>}
          <div className={`msg-row ${m.mine ? 'mine' : ''} ${grouped ? 'is-grouped' : ''} ${newlyArrivedRef.current.has(m.id) ? 'is-new' : ''}`}
            data-incoming-id={m.mine || m.seenAt ? undefined : m.id}>
            <div className="message-stack">
              <div className={`msg ${m.mine ? 'mine' : ''}`} role="group"
                aria-label={m.mine ? `Your message, ${fullStamp}` : `Message from ${m.author}, ${fullStamp}`}
                title={fullStamp}>
                <div className="message-text">{m.body}</div>
                {showLastTime && <small className="message-time"><time dateTime={m.createdAt}>
                  {new Date(m.createdAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </time></small>}
              </div>
              {m.mine && m.id === lastMineId && <MessageReceipt key={String(m.id) + '-' + String(m.receipt ?? 'sent')} state={m.receipt ?? 'sent'} />}
            </div>
          </div>
        </div>;
      })}
    </div>
    {d.handoff && <aside className="handoff-panel">
      <Icon name="pin" size={19} />
      <div><strong>Handoff arrangement</strong>
        <p>{d.handoff.method.replaceAll('_', ' ')} · {d.handoff.timeWindow} · <HandoffPlace location={d.handoff.generalLocation} /></p>
        <span className="status">{d.handoff.status.replaceAll('_', ' ')}</span>
      </div>
    </aside>}
    {d.typing && !closed && <div className="typing-indicator conversation-typing-dock" role="status"
      aria-label={`${otherStudentName} is typing`}>
      <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
      <span>{otherStudentName} is typing…</span>
    </div>}
    {closed ? <div className="conversation-closed" role="status">This conversation is closed. You can still read the messages above.</div>
      : <form className="chat-bar conversation-composer" ref={composerRef} onSubmit={e => { e.preventDefault(); void send(); }}>
        <label className="conversation-reply-label" htmlFor="conversation-reply">Your message</label>
        <div className="composer-row">
          <textarea id="conversation-reply" rows={2} value={body} onChange={e => { setBody(e.target.value); ping(); }}
            onFocus={() => window.requestAnimationFrame(() => syncKeyboardRef.current())}
            onBlur={() => window.requestAnimationFrame(() => syncKeyboardRef.current())}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
            enterKeyHint="send" maxLength={1000} placeholder="Type a message…" />
          <LegacyButton className="chat-send" aria-label={busy ? 'Sending message' : 'Send message'} disabled={busy || !body.trim()}><Icon name="arrow" size={19} /></LegacyButton>
        </div>
        <div className="composer-help"><span>Enter to send · Shift+Enter for a new line</span>{body.length > 850 && <span>{body.length}/1000</span>}</div>
      </form>}
    {sendError && <p className="err" role="alert">{sendError}</p>}
  </section>;
}
