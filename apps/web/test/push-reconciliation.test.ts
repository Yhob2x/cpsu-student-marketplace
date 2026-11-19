import { describe, expect, it } from 'bun:test';
import { reconcilePushOwnership } from '../src/push-reconciliation';

describe('browser push ownership during account switching', () => {
  it('keeps a subscription only if the active account is confirmed to own it', async () => {
    let checks = 0, detached = 0;
    const result = await reconcilePushOwnership(
      async () => { checks++; return true; },
      async () => { detached++; return true; },
      () => true,
    );
    expect(result).toBe('owned');
    expect(checks).toBe(1);
    expect(detached).toBe(0);
  });

  it('rechecks a subscription that was concurrently explicitly enabled', async () => {
    let checks = 0, detached = 0;
    const result = await reconcilePushOwnership(
      async () => ++checks === 2,
      async () => { detached++; return true; },
      () => true,
    );
    expect(result).toBe('owned');
    expect(checks).toBe(2);
    expect(detached).toBe(0);
  });

  it('detaches an unowned previous-account subscription', async () => {
    let checks = 0, detached = 0;
    const result = await reconcilePushOwnership(
      async () => { checks++; return false; },
      async () => { detached++; return true; },
      () => true,
    );
    expect(result).toBe('detached');
    expect(checks).toBe(2);
    expect(detached).toBe(1);
  });

  it('fails closed on an ownership lookup failure and does not re-enroll', async () => {
    let detached = 0;
    const result = await reconcilePushOwnership(
      async () => { throw new Error('HTTP 503: temporarily offline'); },
      async () => { detached++; return true; },
      () => true,
    );
    expect(result).toBe('detached');
    expect(detached).toBe(1);
  });

  it('fails closed if the second status lookup fails', async () => {
    let checks = 0, detached = 0;
    const result = await reconcilePushOwnership(
      async () => {
        checks++;
        if (checks === 2) throw new Error('transient API outage');
        return false;
      },
      async () => { detached++; return true; },
      () => true,
    );
    expect(result).toBe('detached');
    expect(detached).toBe(1);
  });

  it('does not touch the endpoint after the user changes accounts mid-request', async () => {
    let current = true, detached = 0;
    const result = await reconcilePushOwnership(
      async () => { current = false; return false; },
      async () => { detached++; return true; },
      () => current,
    );
    expect(result).toBe('cancelled');
    expect(detached).toBe(0);
  });

  it('skips work when the caller was already unmounted', async () => {
    let checks = 0;
    const result = await reconcilePushOwnership(
      async () => { checks++; return false; },
      async () => true,
      () => false,
    );
    expect(result).toBe('cancelled');
    expect(checks).toBe(0);
  });

  it('never reports detached when unsubscribe returns false without throwing', async () => {
    await expect(reconcilePushOwnership(
      async () => false,
      async () => false,
      () => true,
    )).rejects.toThrow('could not remove the previous push subscription');
  });

  it('does not claim a detach succeeded when browser unsubscribe rejects', async () => {
    await expect(reconcilePushOwnership(
      async () => false,
      async () => { throw new Error('browser refused unsubscribe'); },
      () => true,
    )).rejects.toThrow('browser refused unsubscribe');
  });
});
