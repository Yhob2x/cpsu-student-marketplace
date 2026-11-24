import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MeetupLocationCard } from '../src/meetup-location-card';
import {
  decodeMeetupLocation, encodeMeetupLocation, openStreetMapPinUrl, validMeetupPoint,
} from '../src/meetup-location';

describe('private meetup map pin', () => {
  test('encodes and reads a pin without a database migration', () => {
    const location = encodeMeetupLocation('Campus main gate', { lat: 9.827586, lng: 122.82719 });
    expect(location).toBe('Campus main gate [geo:9.82759,122.82719]');
    expect(location.length).toBeLessThanOrEqual(120);
    expect(decodeMeetupLocation(location)).toEqual({
      place: 'Campus main gate', point: { lat: 9.82759, lng: 122.82719 },
    });
  });

  test('preserves existing text-only handoffs and ignores malformed pin syntax', () => {
    expect(decodeMeetupLocation('Student center, ask at the gate')).toEqual({
      place: 'Student center, ask at the gate', point: null,
    });
    expect(decodeMeetupLocation('Room A [geo:999.99999,0.00000]').point).toBeNull();
    expect(decodeMeetupLocation('https://evil.example/?lat=10').point).toBeNull();
  });

  test('rejects invalid coordinates and too-long or missing labels', () => {
    expect(validMeetupPoint({ lat: 85.01, lng: 0 })).toBe(false);
    expect(validMeetupPoint({ lat: 0, lng: Infinity })).toBe(false);
    expect(() => encodeMeetupLocation('Hi', { lat: 1, lng: 2 })).toThrow();
    expect(() => encodeMeetupLocation('x'.repeat(75), { lat: 1, lng: 2 })).toThrow();
  });

  test('builds a fixed, safe OpenStreetMap URL', () => {
    expect(openStreetMapPinUrl({ lat: 9.82759, lng: 122.82719 })).toBe(
      'https://www.openstreetmap.org/?mlat=9.82759&mlon=122.82719#map=17/9.82759/122.82719',
    );
    expect(() => openStreetMapPinUrl({ lat: Number.NaN, lng: 0 })).toThrow();
  });

  test('shows proposed pin to both students and hides editing when locked', () => {
    const html = renderToStaticMarkup(<MeetupLocationCard transactionId={3}
      handoff={{ method: 'campus_pickup', timeWindow: 'Thursday 2 PM',
        generalLocation: 'Campus main gate [geo:9.82759,122.82719]', status: 'proposed' }}
      editable={false} onSaved={async () => {}} />);
    expect(html).toContain('Campus main gate');
    expect(html).not.toContain('Open in OpenStreetMap');
    expect(html).toContain('saved meetup pin is read-only');
    expect(html).not.toContain('Choose meetup pin');
  });
});
