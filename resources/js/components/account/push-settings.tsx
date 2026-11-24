import { useEffect, useState } from 'react';

import { Icon } from '@/components/icons';
import { api, ApiError, explain } from '@/lib/api';
import { currentSubscription, disablePush, enablePush, isIosWithoutHomeScreen, isSubscriptionOwnedByCurrentAccount, previewLocalNotification, supportsPush, type PushConfig, type PushPreferences } from '@/lib/push/push-client';
import { useMe } from '@/providers/session-provider';

const CATEGORIES: { key: keyof PushPreferences; name: string; detail: string }[] = [
  { key: 'messages', name: 'Messages and inquiries', detail: 'Someone contacts you about a listing or replies.' },
  { key: 'listingReviews', name: 'Listing review decisions', detail: 'A listing is approved, rejected, or needs attention.' },
  { key: 'accountUpdates', name: 'Transactions, account and followed stores', detail: 'Important purchase or service-request changes, CPSU affiliation updates and new listings from followed stores.' },
];
const describeError = (error: unknown) =>
  error instanceof ApiError ? explain(error)
    : error instanceof Error ? error.message : 'Could not update alerts. Please try again.';

export function PushSettings() {
  const { me } = useMe();
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api<PushConfig>('/push/config'),
      api<PushPreferences>('/push/preferences'),
      currentSubscription(),
    ]).then(async ([cfg, prefs, subscription]) => {
      const registered = Boolean(cfg.enabled && subscription
        && Notification.permission === 'granted'
        && await isSubscriptionOwnedByCurrentAccount(subscription.endpoint));
      if (!active) return;
      setConfig(cfg);
      setPreferences(prefs);
      setEnabled(registered);
      setError('');
    }).catch((e: unknown) => {
      if (active) setError(describeError(e));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [me?.id]);

  useEffect(() => {
    if (!me || !('serviceWorker' in navigator)) return;
    const onChange = (event: MessageEvent) => {
      if (event.data?.type !== 'CPSU_PUSH_SUBSCRIPTION_CHANGED') return;
      // The worker cannot re-enroll with a student's credentials. Require an
      // explicit Enable action after a browser/OS subscription rotation.
      setEnabled(false);
      setFeedback('This device’s notification connection changed. Choose Enable alerts to reconnect it.');
    };
    navigator.serviceWorker.addEventListener('message', onChange);
    return () => navigator.serviceWorker.removeEventListener('message', onChange);
  }, [me?.id]);

  const turnOn = async () => {
    if (!config?.enabled || !config.publicKey || busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await enablePush(config.publicKey);
      setEnabled(true);
      setFeedback('Notifications enabled on this device. You can change your alert preferences below.');
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const turnOff = async () => {
    if (busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await disablePush();
      setEnabled(false);
      setFeedback('Push notifications disabled on this device. In-app notifications remain available.');
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const previewAlert = async () => {
    if (busy || !enabled) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      await previewLocalNotification();
      setFeedback('Test notification requested on this device. Your browser or operating system may suppress the banner.');
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const savePreference = async (key: keyof PushPreferences, value: boolean) => {
    if (!preferences || busy) return;
    setBusy(true); setError(''); setFeedback('');
    try {
      const next = await api<PushPreferences>('/push/preferences', { method: 'PATCH', body: { [key]: value } });
      setPreferences(next);
      setFeedback('Notification preferences saved.');
    } catch (e) { setError(describeError(e)); }
    finally { setBusy(false); }
  };

  const available = Boolean(config?.enabled && config.publicKey && supportsPush());
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const needsHomeScreen = typeof navigator !== 'undefined' && isIosWithoutHomeScreen();

  return <section className="panel push-settings" aria-labelledby="push-settings-title">
    <div className="push-settings-heading">
      <span className="push-settings-icon" aria-hidden="true"><Icon name="bell" size={21} /></span>
      <div>
        <h2 id="push-settings-title">Phone and desktop alerts</h2>
        <p className="muted">Get notified when you’re away from CPSU Market. Optional and private by default.</p>
      </div>
    </div>
    {loading ? <p className="muted" role="status">Checking notification settings…</p> :
      <>
        <div className="push-settings-controls">
          {enabled ? <>
            <span className="push-settings-state"><Icon name="check" size={16} /> Enabled on this device</span>
            <button type="button" className="btn ghost" disabled={busy}
              onClick={() => void previewAlert()}>Preview a test alert</button>
            <button type="button" className="btn ghost" disabled={busy}
              onClick={() => void turnOff()}>{busy ? 'Updating…' : 'Disable alerts on this device'}</button>
          </> : <>
            <span className="push-settings-state">Push alerts are off on this device</span>
            <button type="button" className="btn" disabled={!available || busy || blocked || needsHomeScreen}
              onClick={() => void turnOn()}>{busy ? 'Enabling…' : 'Enable alerts'}</button>
          </>}
        </div>
        {!config?.enabled && <p className="muted">Push alerts are currently disabled by the server administrator. In-app alerts still work.</p>}
        {config?.enabled && !config.deliveryEnabled && <p className="muted" role="status">Device enrollment is available for staging tests, but background notification delivery remains paused by the server administrator.</p>}
        {config?.enabled && !supportsPush() && <p className="muted">This browser or connection does not support push notifications. Use an HTTPS site and a supported browser.</p>}
        {config?.enabled && needsHomeScreen && <p className="muted">On iPhone, open CPSU Market in Safari, select Share → Add to Home Screen, then open the installed app to enable alerts.</p>}
        {config?.enabled && blocked && <p className="muted">Notifications are blocked in this device or browser. Change the site's notification permission in settings.</p>}
        {config?.enabled && preferences && <fieldset className="push-categories" disabled={busy}>
          <legend>Choose which alerts to receive</legend>
          {CATEGORIES.map(item => <label className="push-category" key={item.key}>
            <input type="checkbox" checked={preferences[item.key]}
              onChange={e => void savePreference(item.key, e.target.checked)} />
            <span><strong>{item.name}</strong><small>{item.detail}</small></span>
          </label>)}
        </fieldset>}
        <p className="muted push-privacy">Lock-screen alerts never show private message text, sender names or review reasons. App badges depend on device support. Notifications can be disabled at any time. The optional test-alert preview checks this device’s local display only; it does not verify background push delivery.</p>
      </>
    }
    {feedback && <p role="status" className="push-settings-feedback">{feedback}</p>}
    {error && <p role="alert" className="err">{error}</p>}
  </section>;
}
