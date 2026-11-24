import type { MeetupPoint } from './meetup-location';

// CPSU campus approximate map centers, based on the satellite-campus locations
// table: https://edcom2.gov.ph/media/2025/01/11_ALMADEN-Economics-of-Satellite-Campuses.pdf
// These centers are for map navigation only, NEVER preselected meeting pins.
const CAMPUS_CENTERS: Record<string, MeetupPoint> = {
  main: { lat: 9.852558318, lng: 122.8904766 },
  cauayan: { lat: 9.968504259, lng: 122.6226015 },
  hinobaan: { lat: 9.594454789, lng: 122.4763332 },
  ilog: { lat: 10.02394424, lng: 122.7714302 },
  sipalay: { lat: 9.77018474, lng: 122.4304958 },
  candoni: { lat: 9.829691408, lng: 122.6429809 },
  hinigaran: { lat: 10.29131178, lng: 122.8554047 },
  moisespadilla: { lat: 10.2771803, lng: 123.0660329 },
  sancarlos: { lat: 10.44762825, lng: 123.3609955 },
  victorias: { lat: 10.8834596, lng: 123.1083915 },
};

// For unknown or administrator-added campuses, do not misleadingly show Main.
export const NEGROS_OVERVIEW: MeetupPoint = { lat: 10.12, lng: 122.87 };

export function campusMapCenter(campusName?: string | null): MeetupPoint | null {
  if (!campusName) return null;
  const normalized = campusName.toLowerCase()
    .replace(/^(?:central philippines state university|cpsu)\s*[-]?\s*/, '')
    .replace(/\bcampus\b/g, '')
    .replace(/\bcity\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return CAMPUS_CENTERS[normalized] ?? null;
}

export function preferredCampusName(
  affiliations: readonly { campus: { name: string }; status: string }[] | null | undefined,
): string | null {
  return affiliations?.find(a => a.status === 'verified')?.campus.name
    ?? affiliations?.[0]?.campus.name ?? null;
}
