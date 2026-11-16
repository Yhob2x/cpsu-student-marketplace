import { describe, expect, it } from 'bun:test';
import { generateVAPIDKeys } from 'web-push';
import {
  evaluatePushPolicy, validPublicHttpsOrigin, validVapidContact, validVapidPair,
  type PushPolicyEnvironment,
} from '../src/push-policy.js';

const keys = generateVAPIDKeys();
const fixture: PushPolicyEnvironment = {
  NODE_ENV: 'production',
  COOKIE_SECURE: 'true',
  CORS_ORIGINS: 'https://market-staging.cpsu.edu.ph',
  PUSH_SUBSCRIPTIONS_ENABLED: 'false',
  PUSH_DELIVERY_ENABLED: 'false',
  VAPID_PUBLIC_KEY: keys.publicKey,
  VAPID_PRIVATE_KEY: keys.privateKey,
  VAPID_SUBJECT: 'mailto:push-support@cpsu.edu.ph',
};

describe('Web Push Stage 5 release gates (no remote delivery)', () => {
  it('rejects unconfigured, mismatched or malformed VAPID key pairs', () => {
    expect(validVapidPair(keys.publicKey, keys.privateKey)).toBe(true);
    expect(validVapidPair(keys.publicKey, generateVAPIDKeys().privateKey)).toBe(false);
    expect(validVapidPair('A'.repeat(87), 'B'.repeat(43))).toBe(false);
    expect(validVapidPair('', '')).toBe(false);
  });

  it('rejects localhost, reserved examples, IP and insecure VAPID contacts', () => {
    expect(validVapidContact('mailto:push-support@cpsu.edu.ph')).toBe(true);
    expect(validVapidContact('https://support.cpsu.edu.ph/help')).toBe(true);
    for (const subject of [
      'https://localhost:8443/', 'mailto:qa@example.invalid', 'https://staging.example.com/',
      'mailto:user@example.com', 'http://cpsu.edu.ph', 'mailto:x@localhost',
      'https://127.0.0.1/help', 'https://cpsu.edu.ph:8443/', 'https://user:pass@cpsu.edu.ph',
      'https://cpsu.edu.ph/?token=private',
    ]) expect(validVapidContact(subject)).toBe(false);
    expect(validVapidContact('mailto:qa-push@example.invalid', true)).toBe(true);
  });

  it('requires a safe public HTTPS staging origin with no wildcard or credentials', () => {
    expect(validPublicHttpsOrigin('https://staging.cpsu.edu.ph')).toBe(true);
    for (const origin of [
      '*', 'http://staging.cpsu.edu.ph', 'https://localhost:8443',
      'https://staging.example.org', 'https://127.0.0.1',
      'https://user:password@cpsu.edu.ph', 'https://cpsu.edu.ph/path',
      'https://cpsu.edu.ph:4443', 'https://cpsu.edu.ph/#fragment',
    ]) expect(validPublicHttpsOrigin(origin)).toBe(false);
  });

  it('fails closed: keys and a real-looking contact alone cannot activate enrollment', () => {
    expect(evaluatePushPolicy(fixture)).toEqual({ subscriptionsEnabled: false, deliveryEnabled: false });
    expect(evaluatePushPolicy({ ...fixture, PUSH_DELIVERY_ENABLED: 'true' }))
      .toEqual({ subscriptionsEnabled: false, deliveryEnabled: false });
  });

  it('allows enrollment only after its separate toggle; delivery remains paused', () => {
    expect(evaluatePushPolicy({ ...fixture, PUSH_SUBSCRIPTIONS_ENABLED: 'true' }))
      .toEqual({ subscriptionsEnabled: true, deliveryEnabled: false });
  });

  it('allows delivery only in explicitly configured production-staging conditions', () => {
    expect(evaluatePushPolicy({ ...fixture,
      PUSH_SUBSCRIPTIONS_ENABLED: 'true', PUSH_DELIVERY_ENABLED: 'true',
    })).toEqual({ subscriptionsEnabled: true, deliveryEnabled: true });
  });

  it('rejects insecure cookies, wildcard CORS, nonpublic contact and broken credentials', () => {
    const ready = { ...fixture, PUSH_SUBSCRIPTIONS_ENABLED: 'true', PUSH_DELIVERY_ENABLED: 'true' };
    const changes: Partial<PushPolicyEnvironment>[] = [
      { COOKIE_SECURE: 'false' },
      { CORS_ORIGINS: '*' },
      { CORS_ORIGINS: 'https://localhost:8443' },
      { CORS_ORIGINS: 'https://staging.cpsu.edu.ph,http://localhost:5173' },
      { VAPID_SUBJECT: 'https://localhost:8443/' },
      { VAPID_SUBJECT: 'mailto:qa@example.invalid' },
      { VAPID_PRIVATE_KEY: 'not-a-key' },
    ];
    for (const change of changes) {
      expect(evaluatePushPolicy({ ...ready, ...change })).toEqual({
        subscriptionsEnabled: false, deliveryEnabled: false,
      });
    }
  });

  it('prevents development and test mode from sending real push, even if toggles are true', () => {
    const ready = { ...fixture, PUSH_SUBSCRIPTIONS_ENABLED: 'true', PUSH_DELIVERY_ENABLED: 'true' };
    expect(evaluatePushPolicy({ ...ready, NODE_ENV: 'development' }))
      .toEqual({ subscriptionsEnabled: false, deliveryEnabled: false });
    expect(evaluatePushPolicy({ ...ready, NODE_ENV: 'test' }))
      .toEqual({ subscriptionsEnabled: true, deliveryEnabled: false });
    expect(evaluatePushPolicy({ ...ready, NODE_ENV: 'test',
      VAPID_SUBJECT: 'mailto:qa-push@example.invalid',
    })).toEqual({ subscriptionsEnabled: true, deliveryEnabled: false });
  });
});
