// Meetup pins are encoded in the existing participant-only Handoff.generalLocation field.
// This avoids a schema migration while retaining the human-readable place description.
// Never interpret arbitrary links or HTML as location data.
export type MeetupPoint = { lat: number; lng: number };
const suffix = / \[geo:(-?\d{1,2}\.\d{5}),(-?\d{1,3}\.\d{5})\]$/;

export function validMeetupPoint(point: MeetupPoint): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && point.lat >= -85 && point.lat <= 85 && point.lng >= -180 && point.lng <= 180;
}

export function encodeMeetupLocation(place: string, point: MeetupPoint): string {
  const label = place.trim();
  if (label.length < 3 || label.length > 74 || !validMeetupPoint(point)) {
    throw new Error('Choose a valid meetup place and map pin.');
  }
  return `${label} [geo:${point.lat.toFixed(5)},${point.lng.toFixed(5)}]`;
}

export function decodeMeetupLocation(location: string): { place: string; point: MeetupPoint | null } {
  const match = location.match(suffix);
  if (!match) return { place: location, point: null };
  const point = { lat: Number(match[1]), lng: Number(match[2]) };
  return validMeetupPoint(point)
    ? { place: location.slice(0, match.index), point }
    : { place: location, point: null };
}

export function openStreetMapPinUrl(point: MeetupPoint): string {
  if (!validMeetupPoint(point)) throw new Error('Invalid meetup pin');
  const lat = point.lat.toFixed(5);
  const lng = point.lng.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
