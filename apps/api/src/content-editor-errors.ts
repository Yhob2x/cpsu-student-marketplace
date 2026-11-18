import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { HttpError } from './http.js';

// Only handled for the managed guidelines/announcements admin routes.
// A missing or outdated schema is an activation prerequisite, not an unknown 500.
// Preserve all other errors for the shared handler.
export const contentEditorErrorHandler: ErrorRequestHandler = (error, _req, _res, next) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2021' || error.code === 'P2022')) {
    return next(new HttpError(503, 'managed_content_unavailable',
      'This content editor needs its approved database migration. No content was changed.'));
  }
  next(error);
};
