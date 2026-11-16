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

test('closing clearly communicates that it does not block students on other listings', () => {
  expect(account).toContain('This does not block the student on other listings');
});
