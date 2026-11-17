import { ApiError } from './api';

export function isPublicNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
