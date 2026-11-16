import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: 'validation_error', issues: err.issues } });
  if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  // Concurrent writes may deadlock under MySQL's default isolation. The rejected
  // operation is rolled back; clients may retry instead of seeing a false server failure.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034')
    return res.status(409).json({ error: { code: 'concurrent_transaction_conflict' } });
  console.error(err);
  res.status(500).json({ error: { code: 'internal_error' } });
};
