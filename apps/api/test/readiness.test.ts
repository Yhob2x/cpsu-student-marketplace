import { expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { makeReadinessHandler } from '../src/readiness.js';
import { createApp } from '../src/app.js';

test('internal readiness returns 200 only when the injected DB check succeeds', async () => {
  const app = express();
  app.set('trust proxy', 'loopback');
  let calls = 0;
  app.get('/internal/ready', makeReadinessHandler(async () => { calls++; }));
  const response = await request(app).get('/internal/ready');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(calls).toBe(1);
});

test('internal readiness returns 503 without leaking DB error details', async () => {
  const app = express();
  app.get('/internal/ready', makeReadinessHandler(async () => {
    throw new Error('database_credentials_secret');
  }));
  const response = await request(app).get('/internal/ready');
  expect(response.status).toBe(503);
  expect(response.body).toEqual({ ok: false });
  expect(JSON.stringify(response.body)).not.toContain('database_credentials_secret');
});

test('the real app keeps its database readiness path internal-only', async () => {
  const app = createApp();
  app.set('trust proxy', 'loopback');
  const response = await request(app).get('/internal/ready').set('X-Forwarded-For', '198.51.100.21');
  expect(response.status).toBe(404);
});

test('internal readiness refuses forwarded non-loopback visitors before checking DB', async () => {
  const app = express();
  app.set('trust proxy', 'loopback');
  let calls = 0;
  app.get('/internal/ready', makeReadinessHandler(async () => { calls++; }));
  const response = await request(app).get('/internal/ready').set('X-Forwarded-For', '198.51.100.44');
  expect(response.status).toBe(404);
  expect(calls).toBe(0);
});
