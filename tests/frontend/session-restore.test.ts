import { test, expect } from 'bun:test';
import { setToken, tryRestoreSession } from '../../resources/js/lib/api';

test('guest session probe treats HTTP 204 as signed out without parsing JSON', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    expect(input).toBe('/api/v1/auth/refresh');
    expect(init?.credentials).toBe('include');
    requests++;
    return new Response(null, { status: 204 });
  };
  try {
    setToken(null);
    expect(await tryRestoreSession()).toBe(false);
    expect(requests).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    setToken(null);
  }
});
