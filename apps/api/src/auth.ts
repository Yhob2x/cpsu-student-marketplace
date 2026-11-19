import argon2 from 'argon2';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type { Prisma } from '@prisma/client';
import { env } from './env.js';
import { prisma } from './db.js';
import { HttpError } from './http.js';

import type { AuthUser } from './permissions.js';
import { isStaffAccount } from './permissions.js';
export type { AuthUser };
declare global { namespace Express { interface Request { user?: AuthUser } } }

export const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });
export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p);
export const signAccess = (userId: number) => jwt.sign({ sub: String(userId) }, env.JWT_SECRET, { expiresIn: '15m' });
// Access token cookie scoped to /api/v1/media so <img> tags can authenticate; never sent to mutating routes.
export const MEDIA_COOKIE = 'media';
export const ACCESS_MS = 15 * 60_000;
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// Only the fields used to authorize this request are fetched; in particular, never
// load the password hash for JWT validation. Keep the live DB status/role check.
export const authenticationUserSelect = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  roles: { select: { role: true, campusId: true } },
} as const satisfies Prisma.UserSelect;

// Loads current user and roles on every request: roles in the token are never trusted.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const h = req.headers.authorization ?? (req.cookies?.[MEDIA_COOKIE] ? `Bearer ${req.cookies[MEDIA_COOKIE]}` : undefined);
  if (!h?.startsWith('Bearer ')) return next();
  try {
    const { sub } = jwt.verify(h.slice(7), env.JWT_SECRET) as { sub: string };
    const u = await prisma.user.findUnique({ where: { id: Number(sub) }, select: authenticationUserSelect });
    if (u && u.status === 'active') {
      req.user = { id: u.id, email: u.email, displayName: u.displayName, roles: u.roles.map(r => ({ role: r.role, campusId: r.campusId })) };
    }
  } catch { /* invalid or expired token: treated as logged out */ }
  next();
};
export const requireAuth: RequestHandler = (req, _res, next) => req.user ? next() : next(new HttpError(401, 'unauthenticated'));
export const requireStudent: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthenticated'));
  return isStaffAccount(req.user.roles) ? next(new HttpError(403, 'student_account_required')) : next();
};

export { canReview, reviewCampusIds } from './permissions.js';
import { reviewCampusIds as scopeOf } from './permissions.js';
export const requireReviewer: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'unauthenticated'));
  const c = scopeOf(req.user);
  return c === 'all' || c.length > 0 ? next() : next(new HttpError(403, 'forbidden'));
};
