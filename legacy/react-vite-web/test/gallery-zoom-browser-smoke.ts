import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!existsSync(chrome)) throw new Error('Chrome missing');
const profile = mkdtempSync(join(tmpdir(), 'cpsu-zoom-qa-'));
try {
  const task = Bun.spawn([chrome,
    '--headless=new','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-extensions','--disable-sync',
    '--disable-gpu','--no-sandbox','--user-data-dir=' + profile,
    '--window-size=' + (process.env.GALLERY_QA_SIZE || '390,844'),'--virtual-time-budget=7000','--dump-dom',
    'http://127.0.0.1:5198/test/fixtures/gallery-zoom.html',
  ], { stdout: 'pipe', stderr: 'pipe' });
  const [dom, errors] = await Promise.all([
    new Response(task.stdout).text(), new Response(task.stderr).text()
  ]);
  const exit = await task.exited;
  const status = dom.match(/data-gallery-qa-result="([^"]+)"/)?.[1] ?? 'NOT_FOUND';
  const checks = dom.match(/data-gallery-qa="([^"]+)"/)?.[1] ?? '';
  console.log('CHROME_EXIT=' + exit, 'DOM_LEN=' + dom.length, 'RESULT=' + status);
  console.log('CHECKS=' + checks.replaceAll('&quot;', '"'));
  if (status !== 'PASS') console.error('DIAGNOSTIC=' + errors.slice(0, 1200));
  if (exit !== 0 || status !== 'PASS') process.exitCode = 1;
} finally {
  rmSync(profile, { recursive: true, force: true });
}
