import { describe, expect, test } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { contentEditorErrorHandler } from '../src/content-editor-errors.js';
import { errorHandler } from '../src/http.js';

const missing = (code: string) => new Prisma.PrismaClientKnownRequestError('Schema not active', {
  code, clientVersion: '6.1.0',
});

describe('managed content admin schema failures', () => {
  test.each([
    ['/api/v1/admin/content/guidelines', 'P2021'],
    ['/api/v1/admin/content/announcements', 'P2021'],
    ['/api/v1/admin/content/announcements', 'P2022'],
  ])('%s maps %s to a safe activation response', async (url, code) => {
    const app = express();
    app.get(url, async () => { throw missing(code); });
    app.use('/api/v1/admin/content', contentEditorErrorHandler);
    app.use(errorHandler);
    const res = await request(app).get(url);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('managed_content_unavailable');
    expect(JSON.stringify(res.body)).not.toContain('Schema not active');
  });
});
