import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { requestDiagnostics, type HttpRequestRecord } from '../src/request-diagnostics.js';

describe('request diagnostics', () => {
  test('adds a generated request ID without changing the response', async () => {
    const records: HttpRequestRecord[] = [];
    const app = express();
    app.use(requestDiagnostics(record => records.push(record)));
    app.get('/example', (_req, res) => res.status(200).json({ ok: true }));
    const response = await request(app)
      .get('/example?token=do-not-log')
      .set('X-Request-ID', 'untrusted-value');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers['x-request-id']).not.toBe('untrusted-value');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      event: 'http_request',
      requestId: response.headers['x-request-id'],
      method: 'GET',
      route: '/example',
      status: 200,
    });
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(records)).not.toContain('do-not-log');
  });

  test('uses the full route template, not individual URL IDs, for mounted API routers', async () => {
    const records: HttpRequestRecord[] = [];
    const app = express();
    app.use(requestDiagnostics(record => records.push(record)));
    const router = express.Router();
    router.get('/inquiries/:id/messages', (_req, res) => res.status(200).json({ messages: [] }));
    app.use('/api/v1', router);
    const response = await request(app).get('/api/v1/inquiries/987654/messages?token=private');
    expect(response.status).toBe(200);
    expect(records[0].route).toBe('/api/v1/inquiries/:id/messages');
    expect(records[0].timestamp).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(JSON.stringify(records)).not.toContain('987654');
    expect(JSON.stringify(records)).not.toContain('private');
  });

  test('normalizes mounted router root paths for per-endpoint metrics', async () => {
    const records: HttpRequestRecord[] = [];
    const app = express();
    app.use(requestDiagnostics(record => records.push(record)));
    const router = express.Router();
    router.get('/', (_req, res) => res.json({ ok: true }));
    app.use('/api/v1/home-page', router);
    expect((await request(app).get('/api/v1/home-page')).status).toBe(200);
    expect(records[0].route).toBe('/api/v1/home-page');
  });

  test('does not record private URL fragments or request bodies for unmatched requests', async () => {
    const records: HttpRequestRecord[] = [];
    const app = express();
    app.use(express.json());
    app.use(requestDiagnostics(record => records.push(record)));
    const response = await request(app).post('/private-secret?password=sensitive').send({ secret: 'private-body' });
    expect(response.status).toBe(404);
    expect(records[0].route).toBe('[unmatched]');
    expect(records[0].status).toBe(404);
    expect(JSON.stringify(records)).not.toContain('private-secret');
    expect(JSON.stringify(records)).not.toContain('sensitive');
    expect(JSON.stringify(records)).not.toContain('private-body');
  });
});
