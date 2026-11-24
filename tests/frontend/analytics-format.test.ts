import { describe, expect, test } from 'bun:test';

import { chartValue, formatCount, formatHours, formatPercent, formatPeso, formatShortCount, periodChange, waitingTime } from '../../resources/js/lib/analytics/format';

describe('analytics formatting', () => {
  test('money and counts use Philippine formatting and explain hidden values', () => {
    expect(formatPeso(1250)).toBe('₱1,250');
    expect(formatPeso(99.5)).toBe('₱99.50');
    expect(formatPeso(null)).toBe('—');
    expect(formatCount(12000)).toBe('12,000');
    expect(formatCount('<5')).toBe('Fewer than 5');
    expect(formatShortCount('<5')).toBe('<5');
    expect(chartValue('<5')).toBe(0);
    expect(formatPercent(0.125)).toBe('12.5%');
    expect(formatPercent(null)).toBe('—');
  });

  test('period change is only stated when both periods are known', () => {
    expect(periodChange(150, 100)).toEqual({ direction: 'up', text: '+50%' });
    expect(periodChange(50, 100)).toEqual({ direction: 'down', text: '-50%' });
    expect(periodChange(5, 0)).toEqual({ direction: 'up', text: 'New this period' });
    expect(periodChange(0, 0)).toEqual({ direction: 'flat', text: 'No change' });
    expect(periodChange(1001, 1000)).toEqual({ direction: 'flat', text: 'About the same' });
    expect(periodChange('<5', 10)).toBeNull();
    expect(periodChange(null, 10)).toBeNull();
  });

  test('durations read naturally', () => {
    expect(formatHours(0.4)).toBe('Under 1 hour');
    expect(formatHours(1)).toBe('1 hour');
    expect(formatHours(30)).toBe('30 hours');
    expect(formatHours(72)).toBe('3 days');
    const now = Date.parse('2026-11-24T12:00:00Z');
    expect(waitingTime('2026-11-24T11:30:00Z', now)).toBe('Requested just now');
    expect(waitingTime('2026-11-24T07:00:00Z', now)).toBe('Waiting 5 hours');
    expect(waitingTime('2026-11-22T12:00:00Z', now)).toBe('Waiting 2 days');
  });
});
