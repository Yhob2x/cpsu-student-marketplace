import { describe, expect, test } from 'bun:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/env.js';
import { studentIdentityRegistrationSchema } from '../src/student-identity-registration.js';

describe('private student identity registration (policy-gated; no database writes)', () => {
  test('keeps leading zeroes and trims legal names without imposing an unapproved CPSU ID format', () => {
    expect(studentIdentityRegistrationSchema.parse({
      fullName: '  María Dela Cruz  ', studentIdNumber: '  0012-3456  ',
    })).toEqual({ fullName: 'María Dela Cruz', studentIdNumber: '0012-3456' });
  });

  test('rejects empty, overlong, multiline and unexpected identifier fields', () => {
    for (const data of [
      { fullName: '', studentIdNumber: '00123' },
      { fullName: 'A'.repeat(121), studentIdNumber: '00123' },
      { fullName: 'Student Name', studentIdNumber: '0' },
      { fullName: 'Student Name', studentIdNumber: 'a'.repeat(49) },
      { fullName: 'Student\nName', studentIdNumber: '00123' },
      { fullName: 'Student Name', studentIdNumber: '001\n23' },
      { fullName: 'Student Name', studentIdNumber: '00123', password: 'not an identity field' },
    ]) {
      expect(studentIdentityRegistrationSchema.safeParse(data).success).toBe(false);
    }
  });

  test('registration policy exposes only collection status and never identifiers', async () => {
    const result = await request(createApp()).get('/api/v1/auth/registration-policy');
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ studentIdentityRequired: env.STUDENT_ID_COLLECTION_ENABLED === 'true' });
    expect(result.headers['cache-control']).toBe('no-store');
  });

  test('while collection is disabled, submitted student numbers cannot be silently dropped', async () => {
    if (env.STUDENT_ID_COLLECTION_ENABLED === 'true') return;
    const result = await request(createApp()).post('/api/v1/auth/register').send({
      displayName: 'Buyer', fullName: 'Student Buyer', studentIdNumber: '000123',
      email: 'synthetic-buyer@example.invalid', password: 'password-strong-test', campusId: 1,
    });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('student_identity_registration_unavailable');
  });
});
