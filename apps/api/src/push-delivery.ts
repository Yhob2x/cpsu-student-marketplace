import { generateRequestDetails, type RequestOptions } from 'web-push';
import type { PushRelay } from './push-outbox-delivery.js';

export const PUSH_RELAY_TIMEOUT_MS = 5_000;

export const pushStatus = (error: unknown): number | 'network_error' => {
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === 'number' && Number.isInteger(code) ? code : 'network_error';
};

/** One encrypted HTTP attempt. Scheduling retries is the outbox worker's job. */
export function createPushRelay(
  vapidDetails: NonNullable<RequestOptions['vapidDetails']>, stop?: AbortSignal,
  request: (url: string, init: RequestInit) => Promise<Response> = fetch,
): PushRelay {
  return async (device, payload, ttl) => {
    const details = generateRequestDetails({
      endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth },
    }, JSON.stringify(payload), { TTL: ttl, urgency: 'normal', vapidDetails });
    const deadline = AbortSignal.timeout(PUSH_RELAY_TIMEOUT_MS);
    const response = await request(details.endpoint, {
      method: details.method,
      headers: Object.entries(details.headers).map(([name, value]) => [name, String(value)]),
      body: details.body ? new Uint8Array(details.body) : undefined,
      signal: stop ? AbortSignal.any([stop, deadline]) : deadline,
      redirect: 'manual',
    });
    // Response headers determine the delivery result. The body can contain a
    // capability URL and is irrelevant to worker policy.
    void response.body?.cancel().catch(() => {});
    if (!response.ok) throw { statusCode: response.status, headers: { 'retry-after': response.headers.get('retry-after') } };
  };
}

/**
 * Run per-recipient device deliveries at a fixed concurrency limit, continuing
 * after an individual failure. No queue, network calls, or persisted scheduling
 * is introduced by this helper. The result order matches the input order.
 */
export async function allSettledBounded<T>(
  items: readonly T[],
  concurrency: number,
  action: (item: T, index: number) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  if (items.length === 0) return [];
  const limit = Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1));
  const results: PromiseSettledResult<void>[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next++;
      try {
        await action(items[index]!, index);
        results[index] = { status: 'fulfilled', value: undefined };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));
  return results;
}
