import { ApiError } from '@/lib/api';

export type AuthField = 'displayName' | 'fullName' | 'studentIdNumber' | 'email' | 'password' | 'campusId';

export function authFieldForError(form: 'login' | 'register', error: unknown): AuthField | null {
  if (!(error instanceof ApiError)) return null;
  if (form === 'login' && error.code === 'invalid_credentials') return 'password';
  if (form === 'register' && error.code === 'email_taken') return 'email';
  if (form === 'register' && error.code === 'invalid_campus') return 'campusId';
  return null;
}
