import type { RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { reportRequestSchema, resolvePublicReportTarget, createAuditedPublicReport } from './report-safety.js';

/**
 * Dependency-inject the database so the full Express response/authorization
 * path can be tested with synthetic rows, without touching a student database.
 * Production attaches requireAuth and requireStudent before this handler.
 */
export const makePublicReportHandler = (
  db: Pick<PrismaClient, 'listing' | 'sellerProfile' | '$transaction'>,
): RequestHandler => async (req, res) => {
  const b = reportRequestSchema.parse(req.body);
  const target = await resolvePublicReportTarget(db, req.user!.id, b);
  const result = await db.$transaction(tx => createAuditedPublicReport(tx, req.user!.id, target, b.reason));
  res.status(201).json(result);
};
