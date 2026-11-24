import { test, expect, describe } from 'bun:test';
import { affiliationLabel, campusStatusSummary, displayNameChange } from '../../resources/js/lib/account/profile-presentation';

describe('CPSU affiliation presentation', () => {
  test('uses reviewer-owned verified state and the correct student next step', () => {
    expect(campusStatusSummary([{status: 'verified'}], true)).toMatchObject({
      state: 'verified', actionHref: '/dashboard', actionLabel: 'Manage listings',
    });
    expect(campusStatusSummary([{status: 'verified'}], false).actionLabel).toBe('Open your store');
  });
  test('pending status directs students to existing updates rather than promising automatic approval', () => {
    const result = campusStatusSummary([{ status: 'pending' }], false);
    expect(result.state).toBe('pending');
    expect(result.actionHref).toBe('/notifications');
    expect(result.description).toContain('campus reviewer');
  });
  test('rejected status offers a real review link but does not invent a resubmission route', () => {
    const result = campusStatusSummary([{ status: 'rejected' }], false);
    expect(result.state).toBe('rejected');
    expect(result.actionHref).toBe('/notifications');
    expect(result.description).toContain('official CPSU channels');
  });
  test('missing affiliation uses approved existing guidelines and recognizes the unknown status', () => {
    expect(campusStatusSummary([], false)).toMatchObject({
      state: 'missing', actionHref: '/guidelines',
    });
    expect(campusStatusSummary([{status: 'unknown'}], false)).toMatchObject({
      state: 'unknown', actionHref: '/notifications',
    });
  });
  test('verified takes priority over other affiliations', () => {
    expect(campusStatusSummary([{ status: 'pending' }, { status: 'verified' }], true).state).toBe('verified');
    expect(affiliationLabel('pending')).toBe('Pending review');
    expect(affiliationLabel('rejected')).toBe('Not approved');
    expect(affiliationLabel('custom-status')).toBe('Review status unavailable');
  });
});

describe('display name edits', () => {
  test('unchanged and whitespace-only differences are not submitted', () => {
    expect(displayNameChange(' Sample Student ', 'Sample Student').canSave).toBe(false);
    expect(displayNameChange('Sample Student', 'Sample Student').changed).toBe(false);
  });
  test('rejects invalid edits and enables valid changes', () => {
    expect(displayNameChange('a', 'Sample Student').canSave).toBe(false);
    expect(displayNameChange(' '.repeat(3), 'Sample Student').canSave).toBe(false);
    expect(displayNameChange('b'.repeat(81), 'Sample Student').canSave).toBe(false);
    expect(displayNameChange('New Name', 'Sample Student')).toMatchObject({ canSave: true, trimmed: 'New Name' });
  });
});
