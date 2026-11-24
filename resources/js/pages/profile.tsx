import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { showActionFeedback } from '@/components/action-feedback';
import { Icon, type IconName } from '@/components/icons';
import { SellerAvatarEditor } from '@/components/stores/seller-avatar-editor';
import { SellerStoreDetails } from '@/components/stores/seller-store-details';
import { LegacyButton } from '@/components/ui/legacy-button';
import { Field, Panel } from '@/components/ui/primitives';
import { affiliationLabel, campusStatusSummary, displayNameChange } from '@/lib/account/profile-presentation';
import { api, explain } from '@/lib/api';
import { useMe } from '@/providers/session-provider';

export function Profile() {
  const { me, reload } = useMe();
  const location = useLocation();
  const [name, setName] = useState('');
  const [storeDetailsVersion, setStoreDetailsVersion] = useState(0);
  const storeProfileRef = useRef<HTMLDetailsElement>(null);
  const storeProfileSummaryRef = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (me) setName(me.displayName); }, [me?.displayName]);
  useEffect(() => {
    if (me?.storeId && location.hash === '#store-profile') {
      if (storeProfileRef.current) storeProfileRef.current.open = true;
      const frame = window.requestAnimationFrame(() => {
        storeProfileSummaryRef.current?.focus();
        storeProfileRef.current?.scrollIntoView({ block: 'start' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [me?.storeId, location.hash]);

  if (!me) return <p className="muted" role="status">Loading your profile.</p>;

  const staff = me.roles.some(role => ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'].includes(role.role));
  const reviewer = me.roles.some(role => ['campus_reviewer', 'university_admin'].includes(role.role));
  const status = campusStatusSummary(me.affiliations, Boolean(me.storeId));
  const nameChange = displayNameChange(name, me.displayName);
  const showNameError = nameChange.changed && !nameChange.valid;
  const initials = me.displayName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'S';
  const registeredCampuses = [...new Set(me.affiliations.map(a => a.campus.name))].join(', ');
  const links: { to: string; label: string; icon: IconName }[] = staff
    ? [...(reviewer ? [{ to: '/admin', label: 'Administration', icon: 'shield' as IconName }] : []),
        { to: '/notifications', label: 'Notifications', icon: 'bell' }]
    : [
        { to: '/dashboard', label: 'My listings', icon: 'store' },
        ...(me.storeId ? [{ to: '/profile#store-profile', label: 'Store profile', icon: 'user' as IconName }] : []),
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
      if (updated) { setOk('Display name updated.'); showActionFeedback({ kind: 'success', title: 'Profile updated', message: 'Your display name was saved successfully.' }); }
      else { setErr('Your name was saved, but your account could not refresh. Reload the page to check your profile.'); showActionFeedback({ kind: 'warning', title: 'Saved, but refresh failed', message: 'Reload your profile to see the latest account details.' }); }
    } catch (x) {
      setErr(explain(x));
      showActionFeedback({ kind: 'error', title: 'Profile not updated', message: explain(x) });
    } finally {
      setBusy(false);
    }
  };

  return <div className="profile-page">
    <div className="page-head">
      <div>
        <h1>Profile</h1>
        <p className="muted profile-page-intro">{staff ? 'Manage your staff account and notifications.' : me.storeId ? 'Manage your CPSU account, activity, and store.' : 'Manage your CPSU account and marketplace activity.'}</p>
      </div>
    </div>

    <div className={`profile-grid ${staff ? "profile-grid--staff" : me.storeId ? "profile-grid--seller" : "profile-grid--student"}`}>
      <Panel as="section" className="profile-account">
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
      </Panel>

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

      {!staff && <Panel as="section" className="profile-registration" aria-labelledby="profile-registration-heading">
        <h2 id="profile-registration-heading">Registration information</h2>
        <dl className="profile-registration-list">
          <div><dt>Campus on record</dt><dd><strong>{registeredCampuses || 'No campus on record'}</strong></dd></div>
        </dl>
        <p className="profile-registration-note">Automated CISS checks of student ID, full name and enrollment are not active. Your current affiliation status appears above.</p>
      </Panel>}

      <Panel as="section" className="profile-settings" aria-labelledby="account-settings-heading">
        <h2 id="account-settings-heading">Account settings</h2>
        <form className="stack" onSubmit={save}>
          <Field className="" htmlFor="profile-display-name">Display name</Field>
          <input id="profile-display-name" value={name} disabled={busy} onChange={e => {
            setName(e.target.value);
            setOk('');
            setErr('');
          }} required minLength={2} maxLength={80} autoComplete="nickname"
            aria-invalid={showNameError} aria-describedby={showNameError ? 'profile-name-help profile-name-error' : 'profile-name-help'} />
          <p id="profile-name-help" className="muted profile-name-help">Shown to students and reviewers. Changes do not affect campus verification.</p>
          {showNameError && <p className="profile-field-error" id="profile-name-error">Enter 2–80 characters for your display name.</p>}
          <LegacyButton className="profile-save-button" disabled={busy || !nameChange.canSave}>{busy ? 'Saving...' : 'Save changes'}</LegacyButton>
          {ok && <p className="profile-save-success" role="status"><Icon name="check" size={16} />{ok}</p>}
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      </Panel>

      <Panel as="section" className="profile-shortcuts-panel">
        <h2>Quick links</h2>
        <nav aria-label="Profile shortcuts">
          <ul className="profile-shortcuts">
            {links.map(item => <li key={item.to}>
              <Link to={item.to} className="profile-shortcut" onClick={item.to === '/profile#store-profile' ? () => {
                if (storeProfileRef.current) storeProfileRef.current.open = true;
                requestAnimationFrame(() => {
                  storeProfileSummaryRef.current?.focus();
                  storeProfileRef.current?.scrollIntoView({ block: 'start' });
                });
              } : undefined}>
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                <Icon name="arrow" size={16} />
              </Link>
            </li>)}
          </ul>
        </nav>
      </Panel>

      <div className="profile-actions-row">
        {!staff && me.storeId && <details id="store-profile" className="profile-store-disclosure" ref={storeProfileRef}>
          <summary ref={storeProfileSummaryRef}>
            <span><strong>Store profile</strong><small>Name, description and photo</small></span>
            <Icon name="chevronDown" size={20} />
          </summary>
          <div className="profile-store-editors">
            <SellerStoreDetails storeId={me.storeId} onSaved={() => setStoreDetailsVersion(n => n + 1)} />
            <SellerAvatarEditor storeId={me.storeId} refreshVersion={storeDetailsVersion} />
          </div>
        </details>}
      </div>
    </div>
  </div>;
}
