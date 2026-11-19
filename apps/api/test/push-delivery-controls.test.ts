import { describe, expect, it } from 'bun:test';
import {
  PUSH_DAILY_CAP, PUSH_MAX_ATTEMPTS, PUSH_TIME_ZONE,
  evaluatePushEligibility, inQuietHours, manilaDayAndMinute,
  nextRetryAt, validQuietWindow,
} from '../src/push-delivery-controls.js';

const base = {
  masterEnabled: true, categoryEnabled: true, activeUser: true,
  validSubscription: true, quietStartMinute: null, quietEndMinute: null,
  reservedToday: 0,
};
const at = (iso: string) => new Date(iso);

describe('staged Web Push controls; pure functions, no subscriptions or database writes', () => {
  it('uses a Manila calendar day instead of UTC midnight', () => {
    expect(PUSH_TIME_ZONE).toBe('Asia/Manila');
    expect(manilaDayAndMinute(at('2026-11-19T15:59:00Z'))).toEqual({
      dayKey: '2026-11-19', minuteOfDay: 23 * 60 + 59,
    });
    expect(manilaDayAndMinute(at('2026-11-19T16:00:00Z'))).toEqual({
      dayKey: '2026-11-20', minuteOfDay: 0,
    });
  });

  it('uses half-open daytime quiet intervals with exact start and end boundaries', () => {
    expect(validQuietWindow(12 * 60, 13 * 60)).toBe(true);
    expect(inQuietHours(12 * 60 - 1, 12 * 60, 13 * 60)).toBe(false);
    expect(inQuietHours(12 * 60, 12 * 60, 13 * 60)).toBe(true);
    expect(inQuietHours(13 * 60 - 1, 12 * 60, 13 * 60)).toBe(true);
    expect(inQuietHours(13 * 60, 12 * 60, 13 * 60)).toBe(false);
  });

  it('supports overnight quiet hours across midnight', () => {
    const begin = 22 * 60, finish = 7 * 60;
    expect(inQuietHours(21 * 60 + 59, begin, finish)).toBe(false);
    expect(inQuietHours(begin, begin, finish)).toBe(true);
    expect(inQuietHours(23 * 60 + 59, begin, finish)).toBe(true);
    expect(inQuietHours(0, begin, finish)).toBe(true);
    expect(inQuietHours(finish - 1, begin, finish)).toBe(true);
    expect(inQuietHours(finish, begin, finish)).toBe(false);
  });

  it('keeps quiet hours disabled unless the student configures both bounds', () => {
    expect(validQuietWindow(null, null)).toBe(true);
    expect(inQuietHours(0, null, null)).toBe(false);
    expect(inQuietHours(1439, null, null)).toBe(false);
  });

  it('fails closed on malformed or half-specified quiet hours', () => {
    for (const [start, end] of [[0, null], [null, 10], [720, 720], [-1, 700],
      [22 * 60, 1440], [0.5, 600], [NaN, 100]] as [number | null, number | null][]) {
      expect(validQuietWindow(start, end)).toBe(false);
      expect(inQuietHours(50, start, end)).toBe(true);
    }
  });

  it('honors master off, category off, suspended accounts and missing devices', () => {
    for (const [change, reason] of [
      [{ masterEnabled: false }, 'master_off'],
      [{ categoryEnabled: false }, 'category_off'],
      [{ activeUser: false }, 'inactive'],
      [{ validSubscription: false }, 'no_subscription'],
    ] as const) {
      const result = evaluatePushEligibility({ ...base, ...change }, at('2026-11-19T02:00:00Z'));
      expect(result).toMatchObject({ allowed: false, reason });
    }
  });

  it('reserves at most five recipient-wide notices per Manila day, not five per device', () => {
    expect(PUSH_DAILY_CAP).toBe(5);
    for (let reservedToday = 0; reservedToday < 5; reservedToday++) {
      expect(evaluatePushEligibility({ ...base, reservedToday }, at('2026-11-19T02:00:00Z')))
        .toEqual({ allowed: true, dayKey: '2026-11-19' });
    }
    expect(evaluatePushEligibility({ ...base, reservedToday: 5 }, at('2026-11-19T02:00:00Z')))
      .toMatchObject({ allowed: false, reason: 'daily_cap' });
    expect(evaluatePushEligibility({ ...base, reservedToday: 999 }, at('2026-11-19T02:00:00Z')))
      .toMatchObject({ allowed: false, reason: 'daily_cap' });
  });

  it('rejects invalid or manipulated daily counters rather than allowing sends', () => {
    for (const reservedToday of [-1, 0.4, Number.NaN, Infinity]) {
      expect(evaluatePushEligibility({ ...base, reservedToday }, new Date()))
        .toMatchObject({ allowed: false, reason: 'invalid_budget' });
    }
  });

  it('blocks valid configured quiet hours with an explicit reason', () => {
    expect(evaluatePushEligibility({
      ...base, quietStartMinute: 22 * 60, quietEndMinute: 7 * 60,
    }, at('2026-11-19T15:00:00Z'))).toMatchObject({ allowed: false, reason: 'quiet_hours' });
  });
});

describe('durable outbox proposed retry schedule; pure no network', () => {
  const now = at('2026-11-19T03:00:00Z');
  const ttl = at('2026-11-19T04:00:00Z');
  it('retries only network, 408, 429 and 5xx, never expired or client errors', () => {
    for (const status of ['network_error', 408, 429, 500, 503, 599] as const)
      expect(nextRetryAt(status, 1, now, ttl)).toBeInstanceOf(Date);
    for (const status of [400, 401, 403, 404, 410, 418, 422, 499, 600])
      expect(nextRetryAt(status, 1, now, ttl)).toBeNull();
  });

  it('uses exponential delays and a bound on attempts with deterministic jitter', () => {
    expect(nextRetryAt(503, 1, now, ttl, null, 0.5)?.getTime()! - now.getTime()).toBe(20_000);
    expect(nextRetryAt(503, 2, now, ttl, null, 0.5)?.getTime()! - now.getTime()).toBe(40_000);
    expect(nextRetryAt(503, 3, now, ttl, null, 0.5)?.getTime()! - now.getTime()).toBe(80_000);
    expect(nextRetryAt(503, PUSH_MAX_ATTEMPTS, now, ttl)).toBeNull();
    expect(nextRetryAt(503, 0, now, ttl)).toBeNull();
  });

  it('respects provider Retry-After on 429 without exceeding the job expiry', () => {
    expect(nextRetryAt(429, 1, now, ttl, 100)?.getTime()! - now.getTime()).toBe(100_000);
    expect(nextRetryAt(429, 1, now, ttl, 7200)).toBeNull();
    expect(nextRetryAt(429, 1, now, ttl, -100)?.getTime()! - now.getTime()).toBe(20_000);
  });

  it('never schedules after expiration or for invalid time/attempt inputs', () => {
    expect(nextRetryAt(503, 1, now, now)).toBeNull();
    expect(nextRetryAt(503, 1, now, at('2026-11-19T03:00:05Z'))).toBeNull();
    expect(nextRetryAt(503, Number.NaN, now, ttl)).toBeNull();
    expect(nextRetryAt(503, 1, new Date(NaN), ttl)).toBeNull();
  });
});
