import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, explain, timeAgo } from './api';
import { useMe } from './main';

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
    default: return 'Marketplace update.';
  }
}

export function Profile() {
  const { me, reload, logout } = useMe();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (me) setName(me.displayName); }, [me?.displayName]);

  if (!me) return <p className="muted">Loading your profile</p>;

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/me', { method: 'PATCH', body: { displayName: name.trim() } });
      await reload();
      setOk('Profile updated.');
      setErr('');
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  };

  return <>
    <div className="page-head">
      <div>
        <h1>Profile</h1>
        <p className="muted">How you appear to other students, and where your CPSU affiliation stands.</p>
      </div>
    </div>

    <div className="profile-grid">
      <section className="panel">
        <h2>Your account</h2>
        <dl className="facts">
          <div><dt>Name shown to others</dt><dd>{me.displayName}</dd></div>
          <div><dt>Email</dt><dd>{me.email}</dd></div>
        </dl>
        <p className="muted">Only your display name, campus and listings are visible to other students. Your email is never shown publicly.</p>
      </section>

      <section className="panel">
        <h2>CPSU affiliation</h2>
        {me.affiliations.length === 0 && <p className="muted">No campus affiliation on record.</p>}
        {me.affiliations.map(a => <p key={a.id}>{a.campus.name} <span className={`status ${a.status}`}>{a.status}</span></p>)}
        {!me.storeId && <p className="muted">A campus reviewer confirms your affiliation before you can sell. Browsing and messaging work right away.</p>}
      </section>

      <section className="panel">
        <h2>Where to go</h2>
        <ul className="quick">
          <li><Link to="/dashboard">My listings</Link><span className="muted">{me.storeId ? 'Manage your drafts, reviews and listings' : 'Open a store once your affiliation is verified'}</span></li>
          <li><Link to="/saved">Favorites</Link><span className="muted">Listings you saved for later</span></li>
          <li><Link to="/inquiries">Messages</Link><span className="muted">Conversations with buyers and sellers</span></li>
          <li><Link to="/notifications">Notifications</Link><span className="muted">Review decisions, replies and affiliation updates</span></li>
        </ul>
      </section>

      <section className="panel">
        <h2>Account settings</h2>
        <form className="stack" onSubmit={save} style={{ maxWidth: 'none' }}>
          <label className="field">Display name
            <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="nickname" />
          </label>
          <div className="row">
            <button className="btn" disabled={busy || name.trim().length < 2}>{busy ? 'Saving…' : 'Save name'}</button>
            <button type="button" className="btn ghost" onClick={logout}>Sign out</button>
          </div>
          {ok && <p role="status">{ok}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </form>
        <p className="muted">Changing your name does not change your verification. Reviewers and students see the new name everywhere it is shown.</p>
      </section>
    </div>
  </>;
}

export function Notifications() {
  const { syncUnread, me } = useMe();
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<Notice[]>('/notifications')
    .then(r => { setRows(r); setErr(''); })
    .catch(x => { setErr(explain(x)); setRows([]); });

  // Wait for the shell to restore the session; fetching before that returns 401 and spends a refresh token.
  useEffect(() => { if (me) load(); }, [me?.id]);

  const markAll = async () => {
    setBusy(true);
    try {
      await api('/notifications/read', { method: 'POST', body: {} });
      await load();
      await syncUnread();
      setErr('');
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  };

  const unread = (rows ?? []).filter(r => !r.readAt).length;

  return <>
    <div className="page-head">
      <div>
        <h1>Notifications</h1>
        <p className="muted">Review decisions, replies and affiliation updates. This is the only channel in this version.</p>
      </div>
      <button className="btn ghost" onClick={markAll} disabled={busy || unread === 0}>
        {busy ? 'Marking…' : unread > 0 ? `Mark all ${unread} as read` : 'All read'}
      </button>
    </div>

    {err && <p className="err" role="alert">{err}</p>}

    {rows === null && <div aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="skel" style={{ height: 76, marginBottom: '.5rem' }} />)}
    </div>}

    {rows !== null && rows.length === 0 && !err && <p className="muted">Nothing yet. You will hear here when a reviewer decides on your listing, someone replies to an inquiry, or your affiliation is verified.</p>}

    {rows !== null && rows.length > 0 && <div>
      {rows.map(n => <article key={n.id} className={`notif ${n.readAt ? '' : 'unread'}`}>
        <span className={`dot ${n.readAt ? 'read' : ''}`} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <p>{noticeText(n)}</p>
          <time dateTime={n.createdAt}>{timeAgo(n.createdAt)}</time>{!n.readAt && <span className="muted"> · unread</span>}
        </div>
      </article>)}
    </div>}
  </>;
}
