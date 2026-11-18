import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { useForegroundRefresh } from '../../src/foreground-refresh';
import { hasNewIncomingMessage, messageReceiveSoundEnabled, setMessageReceiveSoundEnabled } from '../../src/message-receive-sound';

const nativeSetInterval = window.setInterval;
const nativeClearInterval = window.clearInterval;
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
let callback: (() => void) | null = null;
let cleared: number[] = [];
let visible = true;
function Harness({ refresh, enabled = true }: { refresh: () => void | Promise<void>; enabled?: boolean }) {
  useForegroundRefresh(refresh, 5_000, enabled);
  return <p>Polling test component</p>;
}
beforeEach(() => {
  callback = null;
  cleared = [];
  visible = true;
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
  window.setInterval = ((fn: TimerHandler) => { callback = fn as () => void; return 25; }) as typeof window.setInterval;
  window.clearInterval = ((id: number) => { cleared.push(id); }) as typeof window.clearInterval;
});
afterEach(() => {
  cleanup();
  window.setInterval = nativeSetInterval;
  window.clearInterval = nativeClearInterval;
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else delete (document as any).visibilityState;
});

describe('Phase 2: controlled fake-clock foreground polling', () => {
  test('installs an interval on mount and removes it when unmounted', async () => {
    let calls = 0;
    const mounted = render(<Harness refresh={() => { calls++; }} />);
    expect(callback).toBeFunction();
    await act(async () => callback?.());
    expect(calls).toBe(1);
    mounted.unmount();
    expect(cleared).toContain(25);
    await act(async () => callback?.());
    expect(calls).toBe(1);
  });

  test('hidden tabs do not poll; visible resume polls once and prevents overlap', async () => {
    let requests = 0;
    let resolve!: () => void;
    const first = new Promise<void>(done => { resolve = done; });
    render(<Harness refresh={() => { requests++; return first; }} />);
    visible = false;
    await act(async () => callback?.());
    expect(requests).toBe(0);
    visible = true;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      callback?.();
    });
    expect(requests).toBe(1);
    await act(async () => { resolve(); await first; });
    await act(async () => callback?.());
    expect(requests).toBe(2);
  });

  test('failed polls retry on the next tick without leaking a rejection', async () => {
    let calls = 0;
    render(<Harness refresh={async () => { calls++; if (calls === 1) throw new Error('synthetic outage'); }} />);
    await act(async () => callback?.());
    await act(async () => callback?.());
    expect(calls).toBe(2);
  });

  test('disabled polling installs no timer', () => {
    render(<Harness refresh={() => { throw new Error('must not run'); }} enabled={false} />);
    expect(callback).toBeNull();
  });
});

describe('Phase 2: incoming-message gate and private browsing preference', () => {
  test('initial history, own messages, repeat polls and background catch-up never ring', () => {
    const incoming = [{ id: 20, mine: false }];
    expect(hasNewIncomingMessage(incoming, new Set(), false, true)).toBe(false);
    expect(hasNewIncomingMessage(incoming, new Set(), true, false)).toBe(false);
    expect(hasNewIncomingMessage([{ id: 21, mine: true }], new Set(), true, true)).toBe(false);
    expect(hasNewIncomingMessage(incoming, new Set([20]), true, true)).toBe(false);
    expect(hasNewIncomingMessage(incoming, new Set(), true, true)).toBe(true);
  });

  test('mute remains active even when browser storage rejects access', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    try {
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('blocked'); } });
      setMessageReceiveSoundEnabled(false);
      expect(messageReceiveSoundEnabled()).toBe(false);
      setMessageReceiveSoundEnabled(true);
      expect(messageReceiveSoundEnabled()).toBe(true);
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
    }
  });
});
