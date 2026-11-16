import { createECDH } from 'node:crypto';

/**
 * Fail-closed release gates for browser subscriptions and external push sending.
 * This policy is side-effect-free (no database access or push network requests).
 * An approved monitored contact and public staging origin remain human release gates:
 * syntactic validity here does NOT constitute institutional approval.
 */
export type PushPolicyEnvironment = {
  NODE_ENV: 'development' | 'test' | 'production';
  COOKIE_SECURE: string;
  CORS_ORIGINS: string;
  PUSH_SUBSCRIPTIONS_ENABLED: string;
  PUSH_DELIVERY_ENABLED: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

const isPublicHostname = (raw: string): boolean => {
  const hostname = raw.toLowerCase().replace(/\.$/, '');
  if (!hostname.includes('.') || !/^[a-z0-9.-]+$/.test(hostname)) return false;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false;
  if (/(?:^|\.)(localhost|local|internal|lan|invalid|test|example)$/.test(hostname)) return false;
  if (/(?:^|\.)example\.(com|net|org)$/.test(hostname)) return false;
  if (hostname.startsWith('-') || hostname.includes('..')) return false;
  return true;
};

export function validPublicHttpsOrigin(raw: string): boolean {
  try {
    const uri = new URL(raw);
    return uri.protocol === 'https:' && !uri.username && !uri.password && !uri.port
      && uri.pathname === '/' && !uri.search && !uri.hash
      && isPublicHostname(uri.hostname);
  } catch { return false; }
}

export function validVapidContact(raw: string, allowSynthetic = false): boolean {
  if (raw.startsWith('mailto:')) {
    const email = raw.slice(7);
    if (!/^[^@\s/?#]+@[^@\s/?#]+\.[^@\s/?#]+$/.test(email)) return false;
    const host = email.slice(email.lastIndexOf('@') + 1);
    return isPublicHostname(host) || (allowSynthetic && host === 'example.invalid');
  }
  try {
    const uri = new URL(raw);
    if (uri.protocol !== 'https:' || !!uri.port || !!uri.username || !!uri.password
      || !!uri.search || !!uri.hash) return false;
    return isPublicHostname(uri.hostname);
  } catch { return false; }
}

export function validVapidPair(publicKey?: string, privateKey?: string): boolean {
  if (!/^[A-Za-z0-9_-]{87}$/.test(publicKey ?? '')
    || !/^[A-Za-z0-9_-]{43}$/.test(privateKey ?? '')) return false;
  try {
    const pair = createECDH('prime256v1');
    pair.setPrivateKey(Buffer.from(privateKey!, 'base64url'));
    return pair.getPublicKey().toString('base64url') === publicKey;
  } catch { return false; }
}

export function evaluatePushPolicy(settings: PushPolicyEnvironment): {
  subscriptionsEnabled: boolean;
  deliveryEnabled: boolean;
} {
  const keysMatch = validVapidPair(settings.VAPID_PUBLIC_KEY, settings.VAPID_PRIVATE_KEY);
  const qaMode = settings.NODE_ENV === 'test';
  const contactValid = validVapidContact(settings.VAPID_SUBJECT ?? '', qaMode);
  const origins = settings.CORS_ORIGINS.split(',').map(value => value.trim());
  const productionReady = settings.NODE_ENV === 'production'
    && settings.COOKIE_SECURE === 'true'
    && origins.length > 0 && origins.every(validPublicHttpsOrigin);

  // Tests may exercise authenticated opt-in without any external relay deliveries.
  // Development never enables real device subscriptions accidentally.
  const subscriptionsEnabled = settings.PUSH_SUBSCRIPTIONS_ENABLED === 'true'
    && keysMatch && contactValid && (qaMode || productionReady);

  const deliveryEnabled = subscriptionsEnabled && settings.PUSH_DELIVERY_ENABLED === 'true'
    && productionReady && !qaMode;

  return { subscriptionsEnabled, deliveryEnabled };
}
