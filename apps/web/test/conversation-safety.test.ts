import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const account = readFileSync(new URL('../src/pages-account.tsx', import.meta.url), 'utf8');

test('students can explicitly end the chat with confirmation and error feedback', () => {
  expect(account).toContain('End conversation');
  expect(account).toContain('End this conversation for both students?');
  expect(account).toContain("api(`/inquiries/${id}/close`");
  expect(account).toContain('closeConfirm &&');
  expect(account).toContain('safetyError &&');
});

test('closed chat errors explain that messaging is no longer available', () => {
  const api = readFileSync(new URL('../src/api.ts', import.meta.url), 'utf8');
  expect(api).toContain("thread_closed: 'This conversation has ended");
});

test('short-phone conversation actions keep the safety button usable', () => {
  const css = readFileSync(new URL('../src/mobile-refinements.css', import.meta.url), 'utf8');
  expect(account).toContain('aria-label="End conversation"');
  expect(css).toContain('.conversation-actions .conversation-sound-preview { display: none; }');
});

test('closing clearly communicates that it does not block students on other listings', () => {
  expect(account).toContain('This does not block the student on other listings');
});
