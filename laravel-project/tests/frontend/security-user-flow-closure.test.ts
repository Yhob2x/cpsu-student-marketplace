import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const src = (file) => readFileSync(new URL('../../resources/js/' + file, import.meta.url), 'utf8');

test('saved route waits for session readiness and redirects guests with safe return URL', () => {
  const shell = src('main.tsx');
  expect(shell).toContain('path="/saved" element={!ready ?');
  expect(shell).toContain('/login?next=%2Fsaved');
  expect(src('pages-account.tsx')).toContain('safeLoginReturn');
});

test('sign-in and registration prevent duplicate submissions and announce pending state', () => {
  const account = src('pages-account.tsx');
  expect(account).toContain('runExclusive');
  expect(account).toContain('Signing in…');
  expect(account).toContain('Creating account…');
  expect(account).toContain('aria-busy={busy}');
  expect(account).toContain('disabled={busy}');
});

test('logout failure does not silently discard local session or produce unhandled rejection', () => {
  const shell = src('main.tsx');
  expect(shell).toContain("setLogoutError('Could not sign out");
  expect(shell).toContain('logoutError &&');
  expect(shell).toContain('disabled={loggingOut}');
});

test('signed-in student can report a seller via the existing report API with validation', () => {
  const page = src('pages-public.tsx');
  expect(page).toContain('sellerProfileId: s.id');
  expect(page).toContain("reason.trim().length < 10");
  expect(page).toContain('Report this seller');
  expect(page).toContain('!staff && !isOwner');
});
