import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

/**
 * Only the student's explicit action activates a waiting service worker.
 * Never refresh automatically on controllerchange if a form was edited.
 */
export function PwaStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [notice, setNotice] = useState('');
  const edited = useRef(false);
  const userRequestedReload = useRef(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Deliberately conservative: once a student edits an input, we will not
    // reload the running tab. Closing/reopening after saving activates a waiting SW.
    const onEdit = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.matches('input:not([type="hidden"]), textarea, select') || target.isContentEditable)) {
        edited.current = true;
      }
    };
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);

    if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) {
      return () => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('input', onEdit, true);
        document.removeEventListener('change', onEdit, true);
      };
    }

    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    let installing: ServiceWorker | null = null;
    const checkWaiting = () => {
      if (active && registration?.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
    };
    const onStateChange = () => checkWaiting();
    const onUpdateFound = () => {
      if (installing) installing.removeEventListener('statechange', onStateChange);
      installing = registration?.installing ?? null;
      installing?.addEventListener('statechange', onStateChange);
      checkWaiting();
    };
    const onControllerChange = () => {
      if (!active || !userRequestedReload.current) return;
      userRequestedReload.current = false;
      if (edited.current) {
        setNotice('Update installed. Save your work, then reopen the app to use it.');
        setWaiting(null);
      } else {
        window.location.reload();
      }
    };
    const checkForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      // A dismissed update should be discoverable again when the student returns.
      checkWaiting();
      void registration?.update().then(checkWaiting).catch(() => {});
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);

    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
      if (!active) return;
      registration = reg;
      reg.addEventListener('updatefound', onUpdateFound);
      onUpdateFound();
      checkForUpdate();
    }).catch(() => {
      // PWA updates are optional: do not block normal browsing or sign-in.
    });

    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
      document.removeEventListener('visibilitychange', checkForUpdate);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      registration?.removeEventListener('updatefound', onUpdateFound);
      installing?.removeEventListener('statechange', onStateChange);
    };
  }, []);

  const activate = () => {
    if (!waiting) return;
    if (edited.current) {
      setNotice('Finish and save your changes, then close and reopen CPSU Market to update safely.');
      return;
    }
    setNotice('Updating the app…');
    userRequestedReload.current = true;
    waiting.postMessage({ type: 'CPSU_ACTIVATE_UPDATE' });
  };

  return <>
    {!online && <div className="pwa-connection" role="status">
      <span>You're offline. Browsing and sending changes need an internet connection.</span>
    </div>}
    {waiting && <aside className="pwa-update" aria-label="App update available">
      <span aria-hidden="true" className="pwa-update__icon"><Icon name="refresh" size={19} /></span>
      <div className="pwa-update__copy">
        <strong>App update available</strong>
        <span>{notice || 'Get the latest CPSU Market improvements without interrupting your work.'}</span>
      </div>
      <div className="pwa-update__actions">
        <button type="button" className="btn" onClick={activate}>Update</button>
        <button type="button" className="btn ghost" onClick={() => { setNotice(''); setWaiting(null); }}>Later</button>
      </div>
    </aside>}
  </>;
}
