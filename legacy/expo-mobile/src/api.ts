import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Set extra.apiUrl in app.json (Android emulator reaches the host at 10.0.2.2; use your LAN IP on a real device).
const CONFIGURED: string = (Constants.expoConfig?.extra as any)?.apiUrl ?? 'http://10.0.2.2:4000/api/v1';

// The web target runs in a browser on the host machine, where 10.0.2.2 (the Android emulator alias) belongs to no server.
// There the API is addressed by hostname so `expo start --web` works without editing app.json.
const webBase = (): string | null => {
  const loc = (globalThis as any)?.window?.location;
  if (!loc?.hostname) return null;
  return `${loc.protocol === 'https:' ? 'https:' : 'http:'}//${loc.hostname}:4000/api/v1`;
};
const BASE: string = webBase() ?? CONFIGURED;
const KEY = 'cpsu_refresh';
let access: string | null = null;

// expo-secure-store has no web implementation and throws there, which surfaced as an uncaught exception at startup.
// The Expo web target therefore keeps the session in memory only; the supported student web app is apps/web, which uses
// httpOnly cookies. Native builds keep using the OS keychain/keystore.
const ON_WEB = typeof (globalThis as any)?.window?.document !== 'undefined';
const keychain = {
  get: (): Promise<string | null> => (ON_WEB ? Promise.resolve(null) : SecureStore.getItemAsync(KEY)),
  set: (v: string): Promise<void> => (ON_WEB ? Promise.resolve() : SecureStore.setItemAsync(KEY, v)),
  del: (): Promise<void> => (ON_WEB ? Promise.resolve() : SecureStore.deleteItemAsync(KEY)),
};

export const imageUrl = (p: string) => BASE.replace('/api/v1', '') + p;
export const peso = (n: number) => `PHP ${Math.round(n).toLocaleString('en-PH')}`;
export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }

async function call(path: string, init: RequestInit) {
  const headers: Record<string, string> = { 'X-Client': 'mobile', ...(init.headers as any) };
  if (access) headers.Authorization = `Bearer ${access}`;
  return fetch(BASE + path, { ...init, headers });
}
export async function refresh(): Promise<boolean> {
  const rt = await keychain.get(); // refresh secret lives in the platform keychain/keystore
  if (!rt) return false;
  const r = await fetch(BASE + '/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' }, body: JSON.stringify({ refreshToken: rt }) });
  if (!r.ok) { await keychain.del(); access = null; return false; }
  const d = await r.json(); access = d.accessToken; await keychain.set(d.refreshToken); return true;
}
export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const init: RequestInit = { method: method ?? (body !== undefined ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) init.body = JSON.stringify(body);
  let res = await call(path, init);
  if (res.status === 401 && !path.startsWith('/auth/') && await refresh()) res = await call(path, init);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? 'error');
  return data;
}
export async function signIn(path: '/auth/login' | '/auth/register', body: object) {
  const d = await api(path, body); access = d.accessToken; await keychain.set(d.refreshToken);
}
export async function signOut() {
  const rt = await keychain.get();
  if (rt) await api('/auth/logout', { refreshToken: rt }).catch(() => {});
  await keychain.del(); access = null;
}
const MSG: Record<string, string> = { invalid_credentials: 'Email or password is incorrect.', email_taken: 'That email already has an account.', own_listing: 'This is your own listing.' };
export const explain = (e: unknown) => (e instanceof ApiError && MSG[e.code]) || 'Something went wrong. Check your connection and try again.';
