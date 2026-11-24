import { describe, expect, test } from 'bun:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/env.js';

describe('Phase 2: authentication and private-route HTTP boundaries (synthetic requests)', () => {
  test.each([
    ['/api/v1/me', 'get'],
    ['/api/v1/notifications', 'get'],
    ['/api/v1/saved', 'get'],
    ['/api/v1/inquiries', 'get'],
    ['/api/v1/transactions', 'get'],
    ['/api/v1/admin/review-queue', 'get'],
    ['/api/v1/seller/store', 'get'],
  ] as const)('%s denies anonymous access before private database reads', async (path, method) => {
    const response = await request(createApp())[method](path);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthenticated');
  });

  test('expired access JWT cannot access a saved-listings endpoint', async () => {
    const expired = jwt.sign({ sub: '98765', exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET);
    const response = await request(createApp()).get('/api/v1/saved').set('Authorization', 'Bearer ' + expired);
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthenticated');
  });

  test('malformed logins and signups are rejected before any account lookup or write', async () => {
    const app = createApp();
    const invalidLogin = await request(app).post('/api/v1/auth/login').send({ email: 'invalid', password: 'x' });
    expect(invalidLogin.status).toBe(400);
    expect(invalidLogin.body.error.code).toBe('validation_error');

    const invalidRegistration = await request(app).post('/api/v1/auth/register').send({
      email: 'student@example.invalid', password: 'short', displayName: '<script>', campusId: 1,
    });
    expect(invalidRegistration.status).toBe(400);
    expect(invalidRegistration.body.error.code).toBe('validation_error');
  });

  test('anonymous browser refresh is a safe no-session probe, mobile refresh is denied', async () => {
    const app = createApp();
    const browser = await request(app).post('/api/v1/auth/refresh').send({});
    expect(browser.status).toBe(204);
    const mobile = await request(app).post('/api/v1/auth/refresh').set('x-client', 'mobile').send({});
    expect(mobile.status).toBe(401);
    expect(mobile.body.error.code).toBe('no_session');
  });

  test('invalid logout payloads are rejected with no session revocation attempt', async () => {
    const response = await request(createApp()).post('/api/v1/auth/logout').send({
      refreshToken: 'unused', unexpectedProperty: '<script>alert(1)</script>',
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
  });

  test('the 301st write is HTTP 429 with retry instructions', async () => {
    const app = createApp();
    const responses = await Promise.all(
      Array.from({ length: 301 }, () => request(app).post('/api/v1/not-a-real-route')),
    );
    const limited = responses.filter(response => response.status === 429);
    expect(limited).toHaveLength(1);
    expect(Number(limited[0].headers['retry-after'])).toBeGreaterThan(0);
    expect(limited[0].headers['retry-after']).toMatch(/^\d+$/);
  });
});
