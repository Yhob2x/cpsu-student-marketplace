import { test, expect } from 'bun:test';
import { ApiError } from '../../resources/js/lib/api';
import { authFieldForError } from '../../resources/js/lib/auth/auth-field-error';

test('authentication errors identify the field to announce and focus', () => {
  expect(authFieldForError('login', new ApiError(401, 'invalid_credentials'))).toBe('password');
  expect(authFieldForError('register', new ApiError(409, 'email_taken'))).toBe('email');
  expect(authFieldForError('register', new ApiError(400, 'invalid_campus'))).toBe('campusId');
  expect(authFieldForError('register', new TypeError('network'))).toBeNull();
});
