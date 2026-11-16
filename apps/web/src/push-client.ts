import { api } from './api';

export type PushPreferences = {
  messages: boolean;
  listingReviews: boolean;
  accountUpdates: boolean;
};
export type PushConfig = { enabled: boolean; deliveryEnabled: boolean; publicKey: string | null };

type BadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export const supportsPush = () => (
  typeof window !== 'undefined' && window.isSecureContext
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
);

export const isIosWithoutHomeScreen = () => {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
};

export async function updateAppBadge(count: number | null) {
  const n = navigator as BadgeNavigator;
  try {
    if (count !== null && count > 0) await n.setAppBadge?.(count);
    else await n.clearAppBadge?.();
  } catch { /* Badging API is optional and may be blocked by the browser or OS. */ }
}

const base64ToBytes = (key: string): Uint8Array<ArrayBuffer> => {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const result = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result;
};

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** Must be called from an explicit, user-activated enable button. */
export async function enablePush(publicKey: string): Promise<void> {
  if (!supportsPush()) throw new Error('Push alerts are unavailable on this device or connection.');
  if (isIosWithoutHomeScreen()) throw new Error('On iPhone, add CPSU Market to your Home Screen before enabling alerts.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked. Enable them for CPSU Market in your device or browser settings.');
  const permission = Notification.permission === 'granted'
    ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted. You can enable it later.');

  // The service worker is registered automatically on production HTTPS. This also supports
  // deliberate permission testing on localhost without caching API responses.
  const registration = await navigator.serviceWorker.register('/sw.js');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('This browser could not create a valid push subscription.');
  }
  try {
    await api('/push/subscriptions', {
      body: {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        expirationTime: json.expirationTime ?? null,
      },
    });
  } catch (error) {
    // Avoid retaining an orphan browser subscription if server-side consent registration failed.
    if (!existing) await subscription.unsubscribe().catch(() => {});
    throw error;
  }
}

/**
 * User-initiated local notification preview for device acceptance.
 * This does NOT use the Web Push relay or prove background push delivery.
 */
export async function previewLocalNotification(): Promise<void> {
  if (!supportsPush()) throw new Error('Notifications are unavailable on this device or connection.');
  if (Notification.permission !== 'granted') {
    throw new Error('Enable notifications on this device before previewing an alert.');
  }
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('CPSU Market', {
    body: 'This is a test notification from CPSU Market.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-maskable-192.png',
    tag: 'cpsu-local-device-preview',
    data: { url: '/notifications' },
  });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  // Revoke the server capability first so a failed network request cannot leave silent pushes enabled.
  await api('/push/subscriptions', { method: 'DELETE', body: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}

/** Logout must not be blocked by a failed Web Push cleanup request. */
export async function disconnectPushOnLogout(): Promise<void> {
  try { await disablePush(); } catch { /* Logout still revokes the session. */ }
  await updateAppBadge(null);
}
