/**
 * Guest-only smoke. Requires an already-running local web dev server on 127.0.0.1:5198.
 * No credentials, test fixtures, database writes, extensions, or public network calls.
 * Usage: bun test/guest-saved-browser-smoke.ts --guest-only
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (process.argv.length !== 3 || process.argv[2] !== '--guest-only') throw new Error('Explicit --guest-only required');
const origin = 'http://127.0.0.1:5198';
const preflight = await fetch(origin + '/saved').catch(() => null);
if (!preflight?.ok) throw new Error('Local web dev server is not ready on loopback 5198');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!existsSync(chrome)) throw new Error('Chrome unavailable');
const profile = mkdtempSync(join(tmpdir(), 'cpsu-guest-auth-'));
try {
  const task = Bun.spawn([chrome, '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--disable-gpu', '--no-sandbox', '--user-data-dir=' + profile,
    '--virtual-time-budget=3500', '--dump-dom', origin + '/saved'], {stdout: 'pipe', stderr: 'pipe'});
  const [dom, errors] = await Promise.all([new Response(task.stdout).text(), new Response(task.stderr).text()]);
  const exit = await task.exited;
  if (exit !== 0 || !dom.includes('<h1>Sign in</h1>')) {
    console.log('CHROME_EXIT=' + exit + ' DOM_LENGTH=' + dom.length + ' ERROR_SAMPLE=' + errors.slice(0, 500));
    throw new Error('Guest Saved did not redirect to sign-in');
  }
  if (dom.includes('Loading saved listings')) throw new Error('Old guest spinner still present');
  console.log('PASS: Guest /saved redirects to rendered sign-in page. No student data used.');
} finally { rmSync(profile, {recursive: true, force: true}); }
