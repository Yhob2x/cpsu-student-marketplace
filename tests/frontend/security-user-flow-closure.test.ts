import { test, expect } from 'bun:test';
import { PAGE_GROUPS, readSource } from './support/source-files';


test('saved route waits for session readiness and redirects guests with safe return URL', () => {
  const shell = readSource(...PAGE_GROUPS.shell);
  expect(shell).toContain('path="/saved" element={<RequireStudent next="%2Fsaved">');
  expect(shell).toContain('if (!ready) return <p role="status">Checking session…</p>;');
  expect(shell).toContain('<Navigate to={`/login?next=${next ?? encodeURIComponent(window.location.pathname)}`} replace />');
  expect(readSource(...PAGE_GROUPS.account)).toContain('safeLoginReturn');
});

test('sign-in and registration prevent duplicate submissions and announce pending state', () => {
  const account = readSource(...PAGE_GROUPS.account);
  expect(account).toContain('runExclusive');
  expect(account).toContain('Signing in…');
  expect(account).toContain('Creating account…');
  expect(account).toContain('aria-busy={busy}');
  expect(account).toContain('disabled={busy}');
});

test('logout failure does not silently discard local session or produce unhandled rejection', () => {
  const shell = readSource(...PAGE_GROUPS.shell);
  expect(shell).toContain("setLogoutError('Could not sign out");
  expect(shell).toContain('logoutError &&');
  expect(shell).toContain('disabled={loggingOut}');
});

test('signed-in student can report a seller via the existing report API with validation', () => {
  const page = readSource(...PAGE_GROUPS.public);
  expect(page).toContain('sellerProfileId: s.id');
  expect(page).toContain("reason.trim().length < 10");
  expect(page).toContain('Report this seller');
  expect(page).toContain('!staff && !isOwner');
});
