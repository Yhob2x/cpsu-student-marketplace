import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { PushSettings } from '@/components/account/push-settings';
import { IconAction } from '@/components/icon-action';
import { Icon } from '@/components/icons';
import { LegacyButton } from '@/components/ui/legacy-button';
import { useForegroundRefresh } from '@/hooks/use-foreground-refresh';
import { type Notice, type NoticeFilter, notificationGroup, noticeTarget, notificationKind, noticeText } from '@/lib/account/notifications';
import { api, explain, timeAgo } from '@/lib/api';
import { useMe } from '@/providers/session-provider';

export function Notifications() {
  const preferencesRef = useRef<HTMLDetailsElement>(null);
  const [preferencesPhase, setPreferencesPhase] = useState<'idle' | 'opening' | 'closing'>('idle');
  const [preferencesInstant, setPreferencesInstant] = useState(false);
  const { syncUnread, me } = useMe();
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [err, setErr] = useState('');
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [busy, setBusy] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const noticeError = (error: unknown, fallback: string) => {
    const explanation = explain(error);
    return /^[a-z][a-z0-9_]+$/.test(explanation) ? fallback : explanation;
  };

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const next = await api<Notice[]>('/notifications');
      setRows(next);
      setErr('');
      if (manual) setFeedback('Notifications refreshed.');
    } catch (x) {
      // Preserve existing notifications on a refresh failure; never display a false empty state.
      setErr(noticeError(x, 'Could not load notifications. Check your connection and try again.'));
    } finally {
      if (manual) setRefreshing(false);
    }
  };

  // Wait until the login session has been restored to avoid an unnecessary token refresh.
  useEffect(() => { if (me) void load(); }, [me?.id]);
  // The open notification inbox follows new messages, approvals, and store publications.
  // Skip automatic reloads during read actions to avoid a stale response overwriting them.
  useForegroundRefresh(() => {
    if (!busy && markingId === null && !refreshing) return load();
  }, 4_000, Boolean(me));

  const unread = (rows ?? []).filter(r => !r.readAt).length;
  const visible = (rows ?? []).filter(r => filter === 'all' || !r.readAt);
  const groups = (['Today', 'Yesterday', 'Earlier'] as const)
    .map(label => ({ label, items: visible.filter(n => notificationGroup(n.createdAt) === label) }))
    .filter(group => group.items.length > 0);

  const markAll = async () => {
    if (busy || markingId !== null || unread === 0) return;
    setBusy(true);
    setErr('');
    setFeedback('');
    try {
      await api('/notifications/read', { method: 'POST', body: {} });
      const readAt = new Date().toISOString();
      setRows(prev => prev?.map(n => ({ ...n, readAt: n.readAt ?? readAt })) ?? null);
      await syncUnread();
      setFeedback('All notifications marked as read.');
    } catch (x) {
      setErr(noticeError(x, 'Could not mark notifications as read. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const markOne = async (id: number) => {
    if (busy || markingId !== null) return;
    setMarkingId(id);
    setErr('');
    setFeedback('');
    try {
      await api('/notifications/' + id + '/read', { method: 'POST', body: {} });
      const readAt = new Date().toISOString();
      setRows(prev => prev?.map(n => n.id === id ? { ...n, readAt: n.readAt ?? readAt } : n) ?? null);
      await syncUnread();
      setFeedback('Notification marked as read.');
    } catch (x) {
      setErr(noticeError(x, 'Could not mark this notification as read. Please try again.'));
    } finally {
      setMarkingId(null);
    }
  };

  return <section className="notifications-page">
    <header className="notifications-heading">
      <div>
        <h1>Notifications</h1>
      </div>
      <IconAction className="notifications-refresh" icon="refresh" label="Refresh notifications"
        onClick={() => void load(true)} disabled={busy || markingId !== null} busy={refreshing} />
    </header>

    <div className="notifications-summary">
      <span className="notifications-summary-icon" aria-hidden="true"><Icon name="bell" size={23} /></span>
      <div className="notifications-summary-copy">
        <strong>{rows === null ? (err ? 'Notifications unavailable' : 'Checking notifications…') : unread > 0
          ? unread + ' unread' : 'You’re caught up'}</strong>
        {rows === null && err && <p>Try again to load your notifications.</p>}
      </div>
      <LegacyButton type="button" className="notifications-mark-all" onClick={() => void markAll()}
        disabled={rows === null || busy || markingId !== null || unread === 0} aria-busy={busy}
        aria-label={busy ? 'Marking all notifications as read' : 'Mark all as read'}
        title={busy ? 'Marking all notifications as read' : 'Mark all as read'}>
        <Icon name="checks" size={19} />
        <span className="sr-only">{busy ? 'Marking notifications read' : 'Mark all read'}</span>
      </LegacyButton>
    </div>

    <div className="notifications-toolbar">
      <div className="notifications-filters" role="group" aria-label="Filter notifications">
        <button type="button" aria-pressed={filter === 'all'}
          className={filter === 'all' ? 'is-selected' : ''} onClick={() => setFilter('all')}>
          All <span>{rows?.length ?? 0}</span>
        </button>
        <button type="button" aria-pressed={filter === 'unread'}
          className={filter === 'unread' ? 'is-selected' : ''} onClick={() => setFilter('unread')}>
          Unread <span>{unread}</span>
        </button>
      </div>
      <span className="notifications-recent-note">Most recent 50 notifications</span>
    </div>

    {err && <div className="notifications-error" role="alert">
      <p>{err}</p>
      <LegacyButton type="button" className="ghost" onClick={() => void load(true)} disabled={refreshing}>
        Try again
      </LegacyButton>
    </div>}
    <p className="notifications-feedback" role="status" aria-atomic="true">{feedback}</p>

    {rows === null && !err && <div aria-label="Loading notifications" role="status" className="notifications-loading">
      <span className="visually-hidden">Loading notifications…</span>
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="skel notifications-skeleton" />)}
    </div>}

    {rows !== null && rows.length === 0 && !err && <div className="notifications-empty">
      <span className="notifications-empty-icon" aria-hidden="true"><Icon name="bell" size={28} /></span>
      <h2>No notifications yet</h2>
      <p>New listings from stores you follow, messages and account updates will appear here.</p>
      <Link className="btn" to="/explore">Explore listings <Icon name="arrow" size={16} /></Link>
    </div>}

    {rows !== null && rows.length > 0 && visible.length === 0 && <div className="notifications-empty">
      <span className="notifications-empty-icon" aria-hidden="true"><Icon name="check" size={28} /></span>
      <h2>No unread notifications</h2>
      <p>You’re all caught up. Your previous updates are still available.</p>
      <LegacyButton type="button" className="ghost" onClick={() => setFilter('all')}>Show all notifications</LegacyButton>
    </div>}

    {groups.length > 0 && <div className="notifications-feed">
      {groups.map(group => <section className="notifications-group" aria-label={group.label + ' notifications'} key={group.label}>
        <div className="notifications-group-heading">
          <h2>{group.label}</h2><span>{group.items.length}</span>
        </div>
        <div className="notifications-list">
          {group.items.map(n => {
            const to = noticeTarget(n);
            const kind = notificationKind(n);
            const absoluteTime = new Date(n.createdAt).toLocaleString('en-PH', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            });
            const content = <>
              <span className={'notification-icon tone-' + kind.tone} aria-hidden="true">
                <Icon name={kind.icon} size={21} />
              </span>
              <span className="notification-content">
                <span className="notification-heading">
                  <strong>{kind.title}</strong>
                  <time dateTime={n.createdAt} title={absoluteTime}>{timeAgo(n.createdAt)}</time>
                </span>
                <span className="notification-description" id={`notice-description-${n.id}`}>{noticeText(n)}</span>
                <span className="notification-meta">
                  <span>{kind.label}</span>
                  {!n.readAt && <span className="notification-new"><span className="notification-new-dot" aria-hidden="true" /> New</span>}
                </span>
              </span>
            </>;
            return <article className={'notification-item' + (!n.readAt ? ' is-unread' : '')} key={n.id}>
              {to
                ? <Link to={to} className="notification-body-link"
                    onClick={() => { if (!n.readAt) void markOne(n.id); }}>{content}<Icon name="arrow" size={17} /></Link>
                : <div className="notification-body-static">{content}</div>}
              {!n.readAt && <div className="notification-actions">
                <IconAction className="notification-mark-one" icon="check"
                  label={'Mark ' + kind.title + ' as read'}
                  aria-describedby={`notice-description-${n.id}`}
                  onClick={() => void markOne(n.id)}
                  disabled={busy || markingId !== null} busy={markingId === n.id} />
              </div>}
            </article>;
          })}
        </div>
      </section>)}
    </div>}
    <details className="notifications-preferences" ref={preferencesRef} data-motion-phase={preferencesPhase} data-instant={preferencesInstant}>
      <summary onClick={event => {
        // Keyboard and reduced-motion users get the instant native disclosure.
        if (event.detail === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setPreferencesInstant(true);
          setPreferencesPhase('idle');
          return;
        }
        setPreferencesInstant(false);
        event.preventDefault();
        if (preferencesPhase === 'closing') {
          setPreferencesPhase('opening'); // Reverse a quick repeated click.
        } else if (preferencesRef.current?.open) {
          setPreferencesPhase('closing');
        } else if (preferencesRef.current) {
          preferencesRef.current.open = true;
          setPreferencesPhase('opening');
        }
      }}>Notification preferences <Icon name="chevronDown" size={19} /></summary>
      <div className="notifications-preferences-content"
        onAnimationEnd={event => {
          if (event.target !== event.currentTarget) return;
          if (event.animationName === 'cpsu-preferences-enter' && preferencesPhase === 'opening') {
            setPreferencesPhase('idle');
          }
          if (event.animationName === 'cpsu-preferences-exit' && preferencesPhase === 'closing') {
            if (preferencesRef.current) preferencesRef.current.open = false;
            setPreferencesPhase('idle');
          }
        }}>
        <PushSettings />
      </div>
    </details>
  </section>;
}
