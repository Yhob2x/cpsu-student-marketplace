import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { Prisma } from '@prisma/client';
import { inquiryAllowsMessage, appendMessageToOpenThread } from '../src/inquiry-safety';
import { HttpError } from '../src/http';

const inquiries = readFileSync(new URL('../src/routes/inquiries.ts', import.meta.url), 'utf8');

describe('conversation close safety', () => {
  test('the guarded Stage 1 runner includes real MySQL conversation closure acceptance', () => {
    const runner = readFileSync(new URL('./run-integration.ts', import.meta.url), 'utf8');
    expect(runner).toContain("'test/integration/inquiry-close.test.ts'");
  });

  test('guarded runner includes sequential bounded close/send stress acceptance', () => {
    const runner = readFileSync(new URL('./run-integration.ts', import.meta.url), 'utf8');
    expect(runner).toContain("'test/integration/inquiry-close-stress.test.ts'");
  });

  test('messages are allowed only when the thread is open', () => {
    expect(inquiryAllowsMessage('open')).toBe(true);
    expect(inquiryAllowsMessage('closed')).toBe(false);
    expect(inquiryAllowsMessage('suspended')).toBe(false);
  });

  test('both inquiry entry points reject closed threads and re-check inside a serializable transaction', () => {
    // Both message paths plus typing and presence must reject closed conversations.
    expect((inquiries.match(/if \(!inquiryAllowsMessage\(t.status\)\) throw new HttpError\(409, 'thread_closed'\)/g) ?? []).length).toBe(4);
    expect((inquiries.match(/const saved = await appendMessageToOpenThread\(tx,/g) ?? []).length).toBe(2);
    expect((inquiries.match(/isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/g) ?? []).length).toBe(3);
  });

  test('closed chat responses mask stale in-memory typing and presence state', () => {
    expect(inquiries).toContain("typing: inquiryAllowsMessage(t.status) &&");
    expect(inquiries).toContain("otherActiveInChat: inquiryAllowsMessage(t.status) &&");
  });

  test('only authorized participants can close and the close and audit share one transaction', () => {
    expect(inquiries).toContain("r.post('/:id/close'");
    expect(inquiries).toContain('await participantThread(req.user!.id, threadId)');
    expect(inquiries).toContain("tx.inquiryThread.findUnique({ where: { id: t.id }");
    expect(inquiries).toContain("tx.inquiryThread.update({ where: { id: t.id }, data: { status: 'closed' } })");
    expect(inquiries).toContain('tx.auditLog.create');
  });

  test('message insert checks status inside the transaction before writing', async () => {
    const steps: string[] = [];
    const tx = {
      inquiryThread: { findUnique: async (data: any) => {
        expect(data).toEqual({ where: { id: 12 }, select: { status: true } });
        steps.push('check'); return { status: 'open' };
      } },
      inquiryMessage: { create: async (data: any) => {
        expect(data.data).toEqual({ threadId: 12, authorUserId: 4, body: 'Still available?' });
        steps.push('insert'); return { id: 80 };
      } },
    } as unknown as Prisma.TransactionClient;
    expect((await appendMessageToOpenThread(tx, 12, 4, 'Still available?')).id).toBe(80);
    expect(steps).toEqual(['check', 'insert']);
  });

  test.each([null, { status: 'closed' }])('closed or missing thread rejects without an insert (%p)', async (row) => {
    let inserted = false;
    const tx = {
      inquiryThread: { findUnique: async () => row },
      inquiryMessage: { create: async () => { inserted = true; return { id: 81 }; } },
    } as unknown as Prisma.TransactionClient;
    await expect(appendMessageToOpenThread(tx, 12, 4, 'Too late'))
      .rejects.toMatchObject({ status: 409, code: 'thread_closed' });
    expect(inserted).toBe(false);
  });
});
