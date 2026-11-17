import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain, timeAgo } from './api';
import { useMe } from './main';
import { Icon, type IconName } from './icons';
import { PushSettings } from './push-settings';
import { InstallApp } from './install-app';
import { affiliationLabel, campusStatusSummary, displayNameChange } from './profile-presentation';

type Notice = { id: number; type: string; payload: any; readAt: string | null; createdAt: string };

const DECISION: Record<string, string> = { approved: 'was approved', changes_requested: 'needs changes', rejected: 'was rejected' };

// Turns a stored notification row into one plain sentence. Unknown types stay visible but generic,
// so adding an event on the server never leaves a blank entry here.
function noticeText(n: Notice): string {
  const p = n.payload ?? {};
  const title = typeof p.title === 'string' && p.title ? `"${p.title}"` : 'Your listing';
  switch (n.type) {
    case 'inquiry.new': return `New inquiry about ${p.listingTitle ?? 'your listing'}.`;
    case 'inquiry.reply': return `New reply about ${p.listingTitle ?? 'your listing'}.`;
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
    case 'transaction.completion_confirmed': return 'The other student reported completion. Both confirmations are required.';
    case 'transaction.cancelled': return 'The other student cancelled the transaction. Review the recorded reason.';
    default: return 'Marketplace update.';
  }
}

// Where a notification takes you when clicked; null keeps the row a plain, non-clickable article.
function noticeTarget(n: Notice): string | null {
  const p = n.payload ?? {};
  if (n.type === 'inquiry.new' || n.type === 'inquiry.reply') return p.threadId ? `/inquiries/${p.threadId}` : null;
  if (n.type === 'listing.decision' || n.type === 'listing.suspended') return p.listingId ? `/listings/${p.listingId}` : null;
  if (n.type === 'affiliation.decision') return '/profile';
  if (n.type.startsWith('transaction.') && Number.isSafeInteger(p.transactionId) && p.transactionId > 0)
    return `/transactions/${p.transactionId}`;
  return null;
}

export function Profile() {
  const { me, reload } = useMe();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (me) setName(me.displayName); }, [me?.displayName]);

  if (!me) return <p className="muted" role="status">Loading your profile.</p>;

  const staff = me.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const reviewer = me.roles.some(role => ['campus_reviewer', 'university_admin'].includes(role.role));
  const status = campusStatusSummary(me.affiliations, Boolean(me.storeId));
  const nameChange = displayNameChange(name, me.displayName);
  const showNameError = nameChange.changed && !nameChange.valid;
  const initials = me.displayName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'S';
  const links: { to: string; label: string; icon: IconName }[] = staff
    ? [...(reviewer ? [{ to: '/admin', label: 'Administration', icon: 'shield' as IconName }] : []),
        { to: '/notifications', label: 'Notifications', icon: 'bell' }]
    : [
        { to: '/dashboard', label: 'My listings', icon: 'store' },
        { to: '/saved', label: 'Saved items', icon: 'heart' },
        { to: '/transactions', label: 'Transactions', icon: 'tag' },
        { to: '/notifications', label: 'Notifications', icon: 'bell' },
      ];

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || !nameChange.canSave) return;
    setBusy(true);
    setOk('');
    setErr('');
    try {
      await api('/me', { method: 'PATCH', body: { displayName: nameChange.trimmed } });
      const updated = await reload();
      if (updated) setOk('Display name updated.');
      else setErr('Your name was saved, but your account could not refresh. Reload the page to check your profile.');
    } catch (x) {
      setErr(explain(x));
    } finally {
      setBusy(false);
    }
  };

  return <div className="profile-page">
    <div className="page-head">
      <div>
        <h1>Profile</h1>
        <p className="muted">{staff ? 'Your staff account and notification settings.' : 'Your student account, CPSU affiliation and settings.'}</p>
      </div>
    </div>

    <div className="profile-grid">
      <section className="panel profile-account">
        <h2>Your account</h2>
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">{initials}</span>
          <div className="profile-identity-copy">
            <strong>{me.displayName}</strong>
            <span>{staff ? 'Staff account' : 'CPSU student account'}</span>
          </div>
        </div>
        <dl className="facts profile-account-facts">
          <div><dt>Email address</dt><dd>{me.email}</dd></div>
        </dl>
        <p className="muted profile-privacy-note"><Icon name="shield" size={15} /> Your email is not displayed publicly.</p>
      </section>

      {!staff && <section className={'panel profile-affiliation profile-affiliation--' + status.state}>
        <h2>CPSU affiliation</h2>
        <div className="profile-review-state">
          <span className={'profile-review-symbol profile-review-symbol--' + status.state} aria-hidden="true">
            <Icon name={status.state === 'verified' ? 'check' : status.state === 'rejected' ? 'flag' : 'shield'} size={19} />
          </span>
          <h3>{status.title}</h3>
        </div>
        {me.affiliations.length > 0 && <ul className="profile-campus-list">
          {me.affiliations.map(a => <li key={a.id}>
            <span>{a.campus.name}</span>
            <span className={'status ' + (['verified', 'pending', 'rejected'].includes(a.status) ? a.status : '')}>
              {affiliationLabel(a.status)}
            </span>
          </li>)}
        </ul>}
        <p className="muted profile-review-description">{status.description}</p>
        <Link className="profile-status-action" to={status.actionHref}>{status.actionLabel}<Icon name="arrow" size={16} /></Link>
        {status.state === 'rejected' && <Link className="profile-status-secondary" to="/guidelines">Read marketplace guidelines</Link>}
      </section>}

      <section className="panel profile-settings">
        <h2>Account settings</h2>
        <form className="stack" onSubmit={save}>
          <label className="field" htmlFor="profile-display-name">Display name</label>
          <input id="profile-display-name" value={name} disabled={busy} onChange={e => {
            setName(e.target.value);
            setOk('');
            setErr('');
          }} required minLength={2} maxLength={80} autoComplete="nickname"
            aria-invalid={showNameError} aria-describedby={showNameError ? 'profile-name-help profile-name-error' : 'profile-name-help'} />
          <p id="profile-name-help" className="muted profile-name-help">Shown to students and reviewers. Changing your name does not affect campus verification.</p>
          {showNameError && <p className="profile-field-error" id="profile-name-error">Enter 2–80 characters for your display name.</p>}
          <button className="btn profile-save-button" disabled={busy || !nameChange.canSave}>{busy ? 'Saving...' : 'Save changes'}</button>
          {ok && <p className="profile-save-success" role="status"><Icon name="check" size={16} />{ok}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      </section>

      <section className="panel profile-shortcuts-panel">
        <h2>Quick links</h2>
        <nav aria-label="Profile shortcuts">
          <ul className="profile-shortcuts">
            {links.map(item => <li key={item.to}>
              <Link to={item.to} className="profile-shortcut">
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                <Icon name="arrow" size={16} />
              </Link>
            </li>)}
          </ul>
        </nav>
      </section>

      <div className="profile-install">
        <InstallApp variant="panel" />
      </div>
    </div>
  </div>;
}

type NoticeGroup = 'Today' | 'Yesterday' | 'Earlier';
type NoticeFilter = 'all' | 'unread';

function notificationGroup(createdAt: string): NoticeGroup {
  const date = new Date(createdAt);
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterday = new Date(dayStart);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= dayStart) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  return 'Earlier';
}

function notificationKind(n: Notice): { title: string; label: string; icon: IconName; tone: string } {
  switch (n.type) {
    case 'inquiry.new': return { title: 'New inquiry', label: 'Messages', icon: 'chat', tone: 'message' };
    case 'inquiry.reply': return { title: 'New reply', label: 'Messages', icon: 'chat', tone: 'message' };
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

export function Notifications() {
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
        <span className="notifications-eyebrow"><Icon name="bell" size={15} /> YOUR ACTIVITY</span>
        <h1>Notifications</h1>
        <p className="muted">Messages, listing reviews and CPSU account updates—all in one place.</p>
      </div>
      <button type="button" className="notifications-refresh" onClick={() => void load(true)}
        disabled={refreshing || busy || markingId !== null} aria-label={refreshing ? 'Refreshing notifications' : 'Refresh notifications'}>
        {refreshing ? 'Refreshing…' : 'Refresh'}
      </button>
    </header>

    <div className="notifications-summary">
      <span className="notifications-summary-icon" aria-hidden="true"><Icon name="bell" size={23} /></span>
      <div className="notifications-summary-copy">
        <strong>{rows === null ? (err ? 'Notifications unavailable' : 'Your activity') : unread > 0
          ? unread + (unread === 1 ? ' unread notification' : ' unread notifications') : 'You’re all caught up'}</strong>
        <p>{rows === null ? (err ? 'Try again to see your recent activity.' : 'Checking recent activity…')
          : unread > 0 ? 'See what needs your attention.' : 'No unread updates right now.'}</p>
      </div>
      <button type="button" className="btn notifications-mark-all" onClick={() => void markAll()}
        disabled={rows === null || busy || markingId !== null || unread === 0}>
        <Icon name="checks" size={17} />
        {busy ? 'Marking…' : 'Mark all read'}
      </button>
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
      <button type="button" className="btn ghost" onClick={() => void load(true)} disabled={refreshing}>
        Try again
      </button>
    </div>}
    <p className="notifications-feedback" role="status" aria-atomic="true">{feedback}</p>

    {rows === null && !err && <div aria-label="Loading notifications" role="status" className="notifications-loading">
      <span className="visually-hidden">Loading notifications…</span>
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="skel notifications-skeleton" />)}
    </div>}

    {rows !== null && rows.length === 0 && !err && <div className="notifications-empty">
      <span className="notifications-empty-icon" aria-hidden="true"><Icon name="bell" size={28} /></span>
      <h2>No notifications yet</h2>
      <p>Your messages, listing decisions and account updates will appear here.</p>
      <Link className="btn" to="/explore">Explore listings <Icon name="arrow" size={16} /></Link>
    </div>}

    {rows !== null && rows.length > 0 && visible.length === 0 && <div className="notifications-empty">
      <span className="notifications-empty-icon" aria-hidden="true"><Icon name="check" size={28} /></span>
      <h2>No unread notifications</h2>
      <p>You’re all caught up. Your previous updates are still available.</p>
      <button type="button" className="btn ghost" onClick={() => setFilter('all')}>Show all notifications</button>
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
                <span className="notification-description">{noticeText(n)}</span>
                <span className="notification-meta">
                  <span>{kind.label}</span>
                  {!n.readAt && <span className="notification-new"><span className="notification-new-dot" aria-hidden="true" /> New</span>}
                </span>
              </span>
            </>;
            return <article className={'notification-item' + (!n.readAt ? ' is-unread' : '')} key={n.id}>
              {to
                ? <Link to={to} className="notification-body-link"
                    onClick={() => { if (!n.readAt) void markOne(n.id); }}>{content}</Link>
                : <div className="notification-body-static">{content}</div>}
              <div className="notification-actions">
                {to && <Link to={to} className="notification-open"
                  onClick={() => { if (!n.readAt) void markOne(n.id); }}
                  aria-label={'Open ' + kind.title}>
                  View <Icon name="arrow" size={16} />
                </Link>}
                {!n.readAt && <button type="button" className="notification-mark-one"
                  onClick={() => void markOne(n.id)}
                  disabled={busy || markingId !== null}
                  aria-label={'Mark ' + kind.title + ' as read'}>
                  {markingId === n.id ? 'Marking…' : 'Mark read'}
                </button>}
              </div>
            </article>;
          })}
        </div>
      </section>)}
    </div>}
    <details className="notifications-preferences">
      <summary>Notification preferences <Icon name="chevronDown" size={19} /></summary>
      <PushSettings />
    </details>
  </section>;
}
