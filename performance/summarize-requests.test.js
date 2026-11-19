import { describe, expect, test } from 'bun:test';
import { createRequestSummary, percentile } from './summarize-requests.mjs';

const record = (data = {}) => ({
  event: 'http_request', timestamp: '2026-11-19T05:00:00.000Z',
  requestId: 'synthetic-not-logged', method: 'GET', route: '/api/v1/listings',
  status: 200, durationMs: 100, ...data,
});

describe('offline request log summary', () => {
  test('captures p95 read/write, route counts, peak RPS and unexpected errors', () => {
    const summary = createRequestSummary();
    for (let i = 0; i < 19; i++) summary.accept(record({ durationMs: 100 + i }));
    summary.accept(record({ durationMs: 290, timestamp: '2026-11-19T05:00:01.000Z' }));
    summary.accept(record({ method: 'POST', route: '/api/v1/inquiries/:id/messages', durationMs: 480,
      timestamp: '2026-11-19T05:00:01.000Z' }));
    summary.accept(record({ status: 503, durationMs: 750,
      timestamp: '2026-11-19T05:00:01.000Z' }));
    summary.accept(record({ status: 429, durationMs: 80,
      timestamp: '2026-11-19T05:00:01.000Z' }));
    const result = summary.result();
    expect(result.accepted).toBe(23);
    expect(result.observedSeconds).toBe(2);
    expect(result.averageRps).toBe(11.5);
    expect(result.peakOneSecondRps).toBe(19);
    expect(result.readP95Ms).toBe(118);
    expect(result.writeP95Ms).toBe(480);
    expect(result.allReadP95Ms).toBe(290);
    expect(result.serverErrors).toBe(1);
    expect(result.limited429).toBe(1);
    expect(result.routes.find(x => x.route === 'GET /api/v1/listings').requests).toBe(22);
    expect(result.routes.find(x => x.route === 'POST /api/v1/inquiries/:id/messages').requests).toBe(1);
    expect(JSON.stringify(result)).not.toContain('synthetic-not-logged');
  });

  test('rejects malformed or private/dynamic routing text rather than displaying it', () => {
    const summary = createRequestSummary();
    summary.acceptLine('not-json');
    summary.accept(record({ route: '/api/v1/users/987654/password=private' }));
    summary.accept(record({ durationMs: -1 }));
    summary.accept(record({ status: 700 }));
    summary.accept(record({ timestamp: 'not-a-date' }));
    summary.accept(record({ event: 'something_else' }));
    expect(summary.result().accepted).toBe(0);
    expect(summary.result().skippedLines).toBe(6);
    expect(summary.result().routes).toEqual([]);
    expect(summary.result().readP95Ms).toBeNull();
  });

  test('reports known response Content-Length without pretending it is gzip bytes', () => {
    const summary = createRequestSummary();
    summary.accept(record({ responseBytes: 42000 }));
    summary.accept(record({ responseBytes: null, timestamp: '2026-11-19T05:00:01.000Z' }));
    summary.accept(record({ responseBytes: 110, timestamp: '2026-11-19T05:00:02.000Z' }));
    const result = summary.result();
    expect(result.knownResponseSizes).toBe(2);
    expect(result.maxResponseBytes).toBe(42000);
    expect(result.routes[0].maxResponseBytes).toBe(42000);
    expect(result.routes[0].knownResponseSizes).toBe(2);
  });

  test('nearest-rank latency percentile works for empty and simple samples', () => {
    expect(percentile([])).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([11, 9, 10], 50)).toBe(10);
  });
});
