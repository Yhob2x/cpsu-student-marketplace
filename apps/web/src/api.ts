let token: string | null = null;
export class ApiError extends Error { constructor(public status: number, public code: string, msg?: string) { super(msg || code); } }

async function raw(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`/api/v1${path}`, { ...init, headers, credentials: 'include' });
}
async function refreshNow() {
  const r = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!r.ok) { token = null; return false; }
  token = (await r.json()).accessToken; return true;
}

// Exactly one refresh may be in flight: the API rotates the refresh token and revokes every session when a spent one is
// presented, so two parallel calls look like theft and log the user out. React StrictMode double-mounts effects, which
// made that race routine on a hard reload of a signed-in page.
let restoring: Promise<boolean> | null = null;
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET') };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers = { 'Content-Type': 'application/json' }; }
  let res = await raw(path, init);
  if (res.status === 401 && !path.startsWith('/auth/') && await tryRestoreSession()) res = await raw(path, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new ApiError(429, 'rate_limited');
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message);
  return data as T;
}
export const setToken = (t: string | null) => { token = t; };
export const tryRestoreSession = (): Promise<boolean> => {
  if (!restoring) restoring = refreshNow().finally(() => { restoring = null; });
  return restoring;
};
export const peso = (n: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(n);

export const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

// Plain-language messages for API error codes.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.', email_taken: 'That email already has an account.',
  affiliation_not_verified: 'Your CPSU affiliation is still being verified. You can sell once a reviewer approves it.',
  category_prohibited: 'This category is not allowed on your campus.', missing_images: 'Add at least one photo before submitting.',
  incomplete_listing: 'Add at least one photo and a price before submitting.', not_editable: 'This listing is in review or closed and cannot be edited.',
  store_exists: 'You already have a store.', own_listing: 'This is your own listing.', validation_error: 'Please check the highlighted fields.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
  not_found: 'That item is no longer available.',
};

export const explain = (e: unknown) => e instanceof ApiError ? (MESSAGES[e.code] ?? e.message) : 'Something went wrong. Check your connection and try again.';
