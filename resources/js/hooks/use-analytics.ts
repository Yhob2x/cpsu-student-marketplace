import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError, explain } from '@/lib/api';
import type { AnalyticsRangeKey } from '@/types/analytics';

type State<T> = { data: T | null; loading: boolean; error: string; errorCode: string | null };

/**
 * Loads an analytics endpoint for a range. Previous figures stay on screen while
 * a new range loads, and a slower earlier response can never replace a newer one.
 */
export function useAnalytics<T>(path: string, range: AnalyticsRangeKey, enabled = true) {
  const [state, setState] = useState<State<T>>({ data: null, loading: enabled, error: '', errorCode: null });
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState(previous => ({ ...previous, loading: true, error: '', errorCode: null }));
    try {
      const data = await api<T>(`${path}?range=${range}`);
      if (id === request.current) setState({ data, loading: false, error: '', errorCode: null });
    } catch (error) {
      if (id === request.current) setState(previous => ({ ...previous, loading: false, error: explain(error), errorCode: error instanceof ApiError ? error.code : null }));
    }
  }, [path, range]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { ...state, retry: load };
}
