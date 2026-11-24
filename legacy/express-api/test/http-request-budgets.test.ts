import { describe, expect, test } from 'bun:test';
import request from 'supertest';
import { createApp } from '../src/app';
import { signAccess } from '../src/auth.js';

describe('shared HTTP request limits', () => {
  test('liveness responds with the same public contract even if a caller sends a valid JWT', async () => {
    const response = await request(createApp()).get('/health')
      .set('Authorization', 'Bearer ' + signAccess(987654));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
  test('health checks cannot exhaust the auth and write budget', async () => {
    const app = createApp();
    const responses = await Promise.all(Array.from({ length: 305 }, () => request(app).get('/health')));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const auth = await request(app).post('/api/v1/auth/refresh');
    expect(auth.status).not.toBe(429);
  });

  test('public GET browsing has a separate budget from the first 300 requests', async () => {
    const app = createApp();
    const responses = await Promise.all(Array.from({ length: 305 }, () => request(app).get('/api/v1/not-a-real-route')));
    expect(responses.every(response => response.status === 404)).toBe(true);
    const auth = await request(app).post('/api/v1/auth/refresh');
    expect(auth.status).not.toBe(429);
  });

  test('write requests remain rate limited', async () => {
    const app = createApp();
    const responses = await Promise.all(Array.from({ length: 302 }, () => request(app).post('/api/v1/not-a-real-route')));
    expect(responses.filter(response => response.status === 429).length).toBe(2);
  });
});

test('read traffic is still bounded rather than unlimited', async () => {
  const app = createApp();
  const responses = await Promise.all(Array.from({ length: 902 }, () => request(app).get('/api/v1/not-a-real-route')));
  expect(responses.filter(response => response.status === 429).length).toBe(2);
});
