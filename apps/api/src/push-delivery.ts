/**
 * A bounded, non-persistent retry for transient browser push-provider errors.
 * This is not a durable outbox: process termination can still lose best-effort push.
 */
export type PushSendResult = {
  outcome: 'sent' | 'expired' | 'failed';
  attempts: number;
  status: number | 'network_error';
};

export const pushStatus = (error: unknown): number | 'network_error' => {
  const code = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof code === 'number' && Number.isInteger(code) ? code : 'network_error';
};

const retryable = (status: PushSendResult['status']) =>
  status === 'network_error' || status === 408 || (typeof status === 'number' && status >= 500 && status < 600);

export async function sendWithBoundedRetries(
  send: () => Promise<unknown>,
  sleep: (ms: number) => Promise<unknown> = ms => new Promise(resolve => setTimeout(resolve, ms)),
): Promise<PushSendResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await send();
      return { outcome: 'sent', attempts: attempt, status: 201 };
    } catch (error) {
      const status = pushStatus(error);
      if (status === 404 || status === 410) return { outcome: 'expired', attempts: attempt, status };
      // Never retry throttling (429), invalid keys, or authorization errors immediately.
      if (attempt === 2 || !retryable(status)) return { outcome: 'failed', attempts: attempt, status };
      await sleep(400);
    }
  }
  return { outcome: 'failed', attempts: 2, status: 'network_error' };
}
