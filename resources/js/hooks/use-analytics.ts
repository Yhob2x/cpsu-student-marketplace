import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiError, explain } from '@/lib/api';
import type { AnalyticsRangeKey } from '@/types/analytics';

type State<T> = { data: T | null; loading: boolean; error: string; errorCode: string | null };
type RequestOptions = { queryKey?: 'range' | 'period'; unversioned?: boolean };

/**
 * Loads an analytics endpoint for a range. Previous figures stay on screen while
 * a new range loads, and a slower earlier response can never replace a newer one.
 */
export function useAnalytics<T>(path: string, range: AnalyticsRangeKey, enabled = true, { queryKey = 'range', unversioned = false }: RequestOptions = {}) {
  const [state, setState] = useState<State<T>>({ data: null, loading: enabled, error: '', errorCode: null });
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    setState(previous => ({ ...previous, loading: true, error: '', errorCode: null }));
    try {
      const data = await api<T>(`${path}?${queryKey}=${range}`, { unversioned });
      if (id === request.current) setState({ data, loading: false, error: '', errorCode: null });
    } catch (error) {
      if (id === request.current) {
        const apiError = error instanceof ApiError ? error : null;
        const accessDenied = apiError?.status === 401 || apiError?.status === 403;
        setState(previous => ({
          ...previous,
          data: accessDenied ? null : previous.data,
          loading: false,
          error: explain(error),
          errorCode: apiError?.code ?? null,
        }));
      }
    }
  }, [path, queryKey, range, unversioned]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { ...state, retry: load };
}
