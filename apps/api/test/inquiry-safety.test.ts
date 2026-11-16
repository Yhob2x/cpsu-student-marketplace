import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { inquiryAllowsMessage } from '../src/inquiry-safety';

const inquiries = readFileSync(new URL('../src/routes/inquiries.ts', import.meta.url), 'utf8');

describe('conversation close safety', () => {
  test('messages are allowed only when the thread is open', () => {
    expect(inquiryAllowsMessage('open')).toBe(true);
    expect(inquiryAllowsMessage('closed')).toBe(false);
    expect(inquiryAllowsMessage('suspended')).toBe(false);
  });

  test('both inquiry entry points refuse closed threads', () => {
    expect((inquiries.match(/if \(!inquiryAllowsMessage\(t.status\)\) throw new HttpError\(409, 'thread_closed'\)/g) ?? []).length).toBe(2);
  });

  test('only authorized participants can close and closing is atomic and audited', () => {
    expect(inquiries).toContain("r.post('/:id/close'");
    expect(inquiries).toContain('await participantThread(req.user!.id, threadId)');
    expect(inquiries).toContain("where: { id: t.id, status: 'open' }");
    expect(inquiries).toContain('tx.auditLog.create');
  });
});
