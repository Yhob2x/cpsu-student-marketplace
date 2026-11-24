import { test, expect } from 'bun:test';
import { runExclusive } from '../../resources/js/auth-submit';

test('submits only once until the current request settles', async () => {
  const lock = { current: false };
  let resolve!: () => void;
  const wait = new Promise<void>(done => { resolve = done; });
  let calls = 0;
  const first = runExclusive(lock, async () => { calls++; await wait; });
  const second = await runExclusive(lock, async () => { calls++; });
  expect(second).toBe(false);
  expect(calls).toBe(1);
  expect(lock.current).toBe(true);
  resolve();
  expect(await first).toBe(true);
  expect(lock.current).toBe(false);
  expect(await runExclusive(lock, async () => { calls++; })).toBe(true);
  expect(calls).toBe(2);
});

test('releases the submission gate after a failed request', async () => {
  const lock = { current: false };
  await expect(runExclusive(lock, async () => { throw new Error('server failed'); })).rejects.toThrow('server failed');
  expect(lock.current).toBe(false);
  expect(await runExclusive(lock, async () => {})).toBe(true);
});
