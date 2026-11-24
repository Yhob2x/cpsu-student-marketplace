import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { mergeMessageHistory } from '../../resources/js/message-history';

const fullChat = readFileSync(new URL('../../resources/js/pages-account.tsx', import.meta.url), 'utf8');
const quickChat = readFileSync(new URL('../../resources/js/floating-chat-panel.tsx', import.meta.url), 'utf8');

describe('paged conversation history', () => {
  test('joins older pages without duplicate messages, preserving chronological order', () => {
    const recent = [{ id: 104, receipt: 'sent' }, { id: 105, receipt: 'sent' }];
    const older = [{ id: 103, receipt: 'sent' }, { id: 104, receipt: 'sent' }];
    const joined = mergeMessageHistory(recent, older);
    expect(joined.map(m => m.id)).toEqual([103, 104, 105]);
    expect(recent.map(m => m.id)).toEqual([104, 105]);
  });

  test('refresh copy overwrites stale receipts without dropping older messages', () => {
    const loaded = [{ id: 1, receipt: 'read' }, { id: 2, receipt: 'sent' }];
    const refreshed = [{ id: 2, receipt: 'delivered' }, { id: 3, receipt: 'sent' }];
    expect(mergeMessageHistory(loaded, refreshed)).toEqual([
      { id: 1, receipt: 'read' }, { id: 2, receipt: 'delivered' }, { id: 3, receipt: 'sent' },
    ]);
  });

  test('both PWA chat readers use bounded history and full chat has an older-page control', () => {
    expect(fullChat).toContain('messages?limit=50`');
    expect(quickChat).toContain('messages?limit=50`');
    expect(fullChat).toContain('limit=50&beforeId=${oldestId}');
    expect(fullChat).toContain('Load earlier messages');
    expect(quickChat).toContain('View earlier messages in full chat');
  });
});
