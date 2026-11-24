import { ApiError } from './api';

export function isPublicNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function publicResourceLoadMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many marketplace requests right now. Wait about a minute, then retry.';
  }
  return 'The server or connection may be unavailable. Try again.';
}
