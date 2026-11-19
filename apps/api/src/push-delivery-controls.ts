/**
 * Pure policy for the separately gated durable Web Push outbox.
 *
 * This module never sends, subscribes, reads a DB, or changes the old delivery
 * path. In-app Notification is canonical even when push is suppressed.
 */
export const PUSH_DAILY_CAP = 5;
export const PUSH_TIME_ZONE = 'Asia/Manila';
export const PUSH_MAX_ATTEMPTS = 5;

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: PUSH_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function manilaDayAndMinute(date: Date): { dayKey: string; minuteOfDay: number } {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid delivery time');
  const p = Object.fromEntries(clock.formatToParts(date).map(part => [part.type, part.value]));
  return {
    dayKey: `${p.year}-${p.month}-${p.day}`,
    minuteOfDay: Number(p.hour) * 60 + Number(p.minute),
  };
}

const minuteOk = (value: number | null): value is number =>
  value !== null && Number.isInteger(value) && value >= 0 && value < 1440;

/** A half-open [start,end) interval; the same minute is not a valid interval. */
export function validQuietWindow(start: number | null, end: number | null): boolean {
  return (start === null && end === null)
    || (minuteOk(start) && minuteOk(end) && start !== end);
}

export function inQuietHours(minuteOfDay: number, start: number | null, end: number | null): boolean {
  if (!validQuietWindow(start, end)) return true; // malformed preferences fail closed
  if (start === null || end === null) return false;
  return start < end
    ? minuteOfDay >= start && minuteOfDay < end
    : minuteOfDay >= start || minuteOfDay < end;
}

export type PushEligibility = {
  masterEnabled: boolean;
  categoryEnabled: boolean;
  activeUser: boolean;
  validSubscription: boolean;
  quietStartMinute: number | null;
  quietEndMinute: number | null;
  reservedToday: number;
};

export type PushDecision = { allowed: true; dayKey: string } | {
  allowed: false; reason: 'inactive' | 'no_subscription' | 'master_off' | 'category_off'
  | 'quiet_hours' | 'daily_cap' | 'invalid_budget';
  dayKey: string;
};

export function evaluatePushEligibility(input: PushEligibility, now: Date): PushDecision {
  const { dayKey, minuteOfDay } = manilaDayAndMinute(now);
  const blocked = (reason: Exclude<PushDecision, { allowed: true }>['reason']): PushDecision =>
    ({ allowed: false, reason, dayKey });
  if (!input.activeUser) return blocked('inactive');
  if (!input.masterEnabled) return blocked('master_off');
  if (!input.categoryEnabled) return blocked('category_off');
  if (!input.validSubscription) return blocked('no_subscription');
  if (!Number.isSafeInteger(input.reservedToday) || input.reservedToday < 0) return blocked('invalid_budget');
  if (input.reservedToday >= PUSH_DAILY_CAP) return blocked('daily_cap');
  if (inQuietHours(minuteOfDay, input.quietStartMinute, input.quietEndMinute)) return blocked('quiet_hours');
  return { allowed: true, dayKey };
}

export type ProviderFailure = number | 'network_error';

/**
 * A network failure, 408, 429, or 5xx is rescheduled by a durable worker.
 * Retry-After is capped by the job expiry. 404/410 are expired endpoints, not
 * resend candidates. This computes only a proposed schedule: no queue is active.
 */
export function nextRetryAt(
  status: ProviderFailure,
  attempt: number,
  now: Date,
  expiresAt: Date,
  retryAfterSeconds: number | null = null,
  jitterFraction = 0.5,
): Date | null {
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiresAt.getTime())) return null;
  if (!Number.isInteger(attempt) || attempt < 1 || attempt >= PUSH_MAX_ATTEMPTS) return null;
  const retryable = status === 'network_error'
    || status === 408 || status === 429
    || (typeof status === 'number' && status >= 500 && status <= 599);
  if (!retryable) return null;
  const jitter = Math.min(1, Math.max(0, Number.isFinite(jitterFraction) ? jitterFraction : 0));
  const exponential = Math.min(900_000, 20_000 * 2 ** (attempt - 1));
  const delay = Math.round(exponential * (0.75 + jitter / 2));
  // A valid Retry-After takes precedence when longer; never shorten provider limits.
  const requested = status === 429 && retryAfterSeconds !== null
    && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
    ? Math.round(retryAfterSeconds * 1000) : 0;
  const next = new Date(now.getTime() + Math.max(delay, requested));
  return next < expiresAt ? next : null;
}
