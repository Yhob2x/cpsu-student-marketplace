import { describe, expect, it } from 'bun:test';
import { sendWithBoundedRetries } from '../src/push-delivery.js';

const failure = (statusCode?: number) => Object.assign(new Error('synthetic push failure'), { statusCode });

describe('bounded Web Push delivery (no network)', () => {
  it('does not retry when the provider confirms a dead subscription', async () => {
    let calls = 0;
    const result = await sendWithBoundedRetries(async () => { calls++; throw failure(410); }, async () => {});
    expect(result).toEqual({ outcome: 'expired', attempts: 1, status: 410 });
    expect(calls).toBe(1);
  });
  it('retries once after a transient provider error', async () => {
    let calls = 0;
    const pauses: number[] = [];
    const result = await sendWithBoundedRetries(async () => {
      if (++calls === 1) throw failure(503);
    }, async ms => { pauses.push(ms); });
    expect(result).toEqual({ outcome: 'sent', attempts: 2, status: 201 });
    expect(pauses).toEqual([400]);
  });
  it('stops after two transient attempts and never loops indefinitely', async () => {
    let calls = 0;
    const result = await sendWithBoundedRetries(async () => {
      calls++;
      throw failure();
    }, async () => {});
    expect(result).toEqual({ outcome: 'failed', attempts: 2, status: 'network_error' });
    expect(calls).toBe(2);
  });
  it('does not immediately retry rate limits, permission errors or invalid subscriptions', async () => {
    for (const code of [400, 401, 403, 429]) {
      let calls = 0;
      const result = await sendWithBoundedRetries(async () => {
        calls++; throw failure(code);
      }, async () => { throw new Error('Unexpected delay'); });
      expect(result.outcome).toBe('failed');
      expect(result.attempts).toBe(1);
      expect(calls).toBe(1);
    }
  });
});
