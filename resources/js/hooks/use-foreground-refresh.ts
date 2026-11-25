import { useEffect, useRef } from 'react';
import { listenRealtime } from '@/lib/realtime';

/**
 * Keep mounted private views current without a full-page reload.
 * Do not poll hidden tabs; refresh promptly when the user returns.
 * A slow request never spawns overlapping requests from this hook.
 */
export function useForegroundRefresh(
  refresh: () => Promise<unknown> | void,
  intervalMs: number,
  enabled = true,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let running = false;
    const run = async () => {
      if (!active || running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        await refreshRef.current();
      } catch {
        // Page-level loaders own their error state; retry on the next tick.
      } finally {
        running = false;
      }
    };
    const resume = () => { void run(); };
    const stopRealtime = listenRealtime(resume, ['account', 'transaction']);
    const timer = window.setInterval(resume, intervalMs);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      active = false;
      stopRealtime();
      window.clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled, intervalMs]);
}
