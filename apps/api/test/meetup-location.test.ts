import { describe, expect, test } from 'bun:test';
import { meetupLocationBody, serializedMeetupLocation } from '../src/meetup-location';

describe('meetup pin server validation', () => {
  const valid = { place: 'Library entrance', timeWindow: 'Friday 2 PM', lat: 9.82759, lng: 122.82719 };

  test('accepts an explicit pin and serializes a backwards-compatible handoff location', () => {
    const input = meetupLocationBody.parse(valid);
    const location = serializedMeetupLocation(input);
    expect(location).toBe('Library entrance [geo:9.82759,122.82719]');
    expect(location.length).toBeLessThanOrEqual(120);
  });

  test('rejects invalid coordinates, extra properties, and malformed labels', () => {
    expect(meetupLocationBody.safeParse({ ...valid, lat: 100 }).success).toBe(false);
    expect(meetupLocationBody.safeParse({ ...valid, lng: -181 }).success).toBe(false);
    expect(meetupLocationBody.safeParse({ ...valid, lat: Number.NaN }).success).toBe(false);
    expect(meetupLocationBody.safeParse({ ...valid, place: 'x'.repeat(75) }).success).toBe(false);
    expect(meetupLocationBody.safeParse({ ...valid, timeWindow: '' }).success).toBe(false);
    expect(meetupLocationBody.safeParse({ ...valid, ownerUserId: 10 }).success).toBe(false);
  });

  test('requires explicit permission when clearing prior meetup confirmations', () => {
    const ordinary = meetupLocationBody.parse(valid);
    expect(ordinary.resetConfirmations).toBe(false);
    const revised = meetupLocationBody.parse({ ...valid, resetConfirmations: true });
    expect(revised.resetConfirmations).toBe(true);
    expect(meetupLocationBody.safeParse({ ...valid, resetConfirmations: 'yes' }).success).toBe(false);
  });

  test('trims human-readable descriptions and keeps them readable', () => {
    const parsed = meetupLocationBody.parse({ ...valid, place: '  CPSU gate  ', timeWindow: '  1 PM  ' });
    expect(parsed.place).toBe('CPSU gate');
    expect(parsed.timeWindow).toBe('1 PM');
    expect(serializedMeetupLocation(parsed)).toContain('CPSU gate [geo:');
  });
});
