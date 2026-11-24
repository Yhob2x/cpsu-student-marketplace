import type { AnalyticsRangeKey, CountValue } from '@/types/analytics';

export const RANGE_OPTIONS: { key: AnalyticsRangeKey; label: string; short: string }[] = [
  { key: '7d', label: 'Last 7 days', short: '7 days' },
  { key: '30d', label: 'Last 30 days', short: '30 days' },
  { key: '90d', label: 'Last 90 days', short: '90 days' },
  { key: '12m', label: 'Last 12 months', short: '12 months' },
];

const wholePeso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const count = new Intl.NumberFormat('en-PH');

export function formatPeso(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  // Whole amounts read cleaner without centavos; partial amounts always show two digits.
  return Number.isInteger(value) ? wholePeso.format(value) : peso.format(value);
}

export function formatCount(value: CountValue | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value === '<5' ? 'Fewer than 5' : count.format(value);
}

export function formatShortCount(value: CountValue | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value === '<5' ? '<5' : count.format(value);
}

export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? '—' : `${Math.round(rate * 1000) / 10}%`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return 'Under 1 hour';
  if (hours < 48) return `${Math.round(hours)} ${Math.round(hours) === 1 ? 'hour' : 'hours'}`;
  return `${Math.round(hours / 24)} days`;
}

/** Numeric value of a possibly suppressed count, for drawing only. */
export function chartValue(value: CountValue | number | null | undefined): number {
  return typeof value === 'number' ? value : 0;
}

export type Change = { direction: 'up' | 'down' | 'flat'; text: string } | null;

/**
 * Change from the previous window, or null when it cannot be stated honestly
 * (hidden or missing values, or nothing to compare against).
 */
export function periodChange(current: CountValue | number | null, previous: CountValue | number | null): Change {
  if (typeof current !== 'number' || typeof previous !== 'number') return null;
  if (current === previous) return { direction: 'flat', text: 'No change' };
  if (previous === 0) return { direction: 'up', text: 'New this period' };
  const percent = Math.round(((current - previous) / previous) * 100);
  return percent === 0 ? { direction: 'flat', text: 'About the same' } : { direction: percent > 0 ? 'up' : 'down', text: `${percent > 0 ? '+' : ''}${percent}%` };
}

/** How long an order has been open, for "needs your action" lists. */
export function waitingTime(createdAt: string, now: number = Date.now()): string {
  const hours = Math.max(0, (now - new Date(createdAt).getTime()) / 3_600_000);
  if (hours < 1) return 'Requested just now';
  if (hours < 24) return `Waiting ${Math.floor(hours)} ${Math.floor(hours) === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}
