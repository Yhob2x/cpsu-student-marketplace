/** Read-only post-WP3 HTTP smoke test. No server startup or synthetic DB writes. */
import { test, expect } from 'bun:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('WP3-activated API responds and enforces transaction authentication', async () => {
  const app = createApp();
  const health = await request(app).get('/health');
  expect(health.status).toBe(200);
  expect(health.body.ok).toBe(true);
  const privateTx = await request(app).get('/api/v1/transactions');
  expect(privateTx.status).toBe(401);
});

test('Undeployed managed-content migrations do not break public fallback reads', async () => {
  const app = createApp();
  const guidelines = await request(app).get('/api/v1/guidelines');
  expect(guidelines.status).toBe(200);
  expect(typeof guidelines.body.body).toBe('string');
  const announcement = await request(app).get('/api/v1/announcements');
  expect(announcement.status).toBe(200);
  expect(announcement.body.items).toEqual([]);
});
