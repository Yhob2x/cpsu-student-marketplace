import { describe, expect, test } from 'bun:test';
import { campusMapCenter, NEGROS_OVERVIEW, preferredCampusName } from '../../resources/js/lib/meetup/meetup-campus';

describe('campus-aware meetup map defaults', () => {
  test('selects the correct university area instead of always showing Main Campus', () => {
    expect(campusMapCenter('Main Campus')).toEqual({ lat: 9.852558318, lng: 122.8904766 });
    expect(campusMapCenter('Cauayan Campus')).toEqual({ lat: 9.968504259, lng: 122.6226015 });
    expect(campusMapCenter('Hinoba-an Campus')).toEqual({ lat: 9.594454789, lng: 122.4763332 });
    expect(campusMapCenter('Ilog Campus')).toEqual({ lat: 10.02394424, lng: 122.7714302 });
    expect(campusMapCenter('Sipalay Campus')).toEqual({ lat: 9.77018474, lng: 122.4304958 });
    expect(campusMapCenter('Candoni Campus')).toEqual({ lat: 9.829691408, lng: 122.6429809 });
    expect(campusMapCenter('CPSU San Carlos Campus')).toEqual({ lat: 10.44762825, lng: 123.3609955 });
    expect(campusMapCenter('CPSU Victorias City Campus')).toEqual({ lat: 10.8834596, lng: 123.1083915 });
    expect(campusMapCenter('CPSU Hinigaran Campus')).toEqual({ lat: 10.29131178, lng: 122.8554047 });
    expect(campusMapCenter('CPSU Moises Padilla Campus')).toEqual({ lat: 10.2771803, lng: 123.0660329 });
  });
  test('does not claim an unknown campus is Main Campus', () => {
    expect(campusMapCenter('New Campus')).toBeNull();
    expect(campusMapCenter(null)).toBeNull();
    expect(NEGROS_OVERVIEW).toEqual({ lat: 10.12, lng: 122.87 });
  });
  test('prefers a verified campus when multiple affiliations exist', () => {
    expect(preferredCampusName([
      { campus: { name: 'Main Campus' }, status: 'pending' },
      { campus: { name: 'Cauayan Campus' }, status: 'verified' },
    ])).toBe('Cauayan Campus');
    expect(preferredCampusName([])).toBeNull();
  });
});
