import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { HttpError } from '../http.js';
import { hashPassword, verifyPassword, signAccess, newRefreshToken, hashToken, MEDIA_COOKIE, ACCESS_MS } from '../auth.js';

const r = Router();
const REFRESH_DAYS = 30;

async function issue(req: any, res: any, userId: number) {
  const refresh = newRefreshToken();
  await prisma.session.create({ data: {
    userId, refreshTokenHash: hashToken(refresh), device: String(req.headers['user-agent'] ?? '').slice(0, 190),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5),
  } });
  const mobile = req.headers['x-client'] === 'mobile';
  const accessToken = signAccess(userId);
  if (!mobile) {
    res.cookie('refresh', refresh, { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true', path: '/api/v1/auth', maxAge: REFRESH_DAYS * 864e5 });
    res.cookie(MEDIA_COOKIE, accessToken, { httpOnly: true, sameSite: 'lax', secure: env.COOKIE_SECURE === 'true', path: '/api/v1/media', maxAge: ACCESS_MS });
  }
  return { accessToken, ...(mobile ? { refreshToken: refresh } : {}) };
}

r.post('/register', async (req, res) => {
  const b = z.object({
    email: z.string().email().toLowerCase(), password: z.string().min(10).max(128),
    displayName: z.string().trim().min(2).max(80), campusId: z.number().int(),
  }).parse(req.body);
  if (!await prisma.campus.findFirst({ where: { id: b.campusId, active: true } })) throw new HttpError(400, 'invalid_campus');
  if (await prisma.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, 'email_taken');
  const user = await prisma.user.create({ data: {
    email: b.email, displayName: b.displayName, passwordHash: await hashPassword(b.password),
    affiliations: { create: { campusId: b.campusId, verificationStatus: 'pending' } },
  } });
  res.status(201).json(await issue(req, res, user.id));
});

r.post('/login', async (req, res) => {
  const b = z.object({ email: z.string().email().toLowerCase(), password: z.string() }).parse(req.body);
  const u = await prisma.user.findUnique({ where: { email: b.email } });
  if (!u || u.status !== 'active' || !await verifyPassword(u.passwordHash, b.password)) throw new HttpError(401, 'invalid_credentials');
  res.json(await issue(req, res, u.id));
});

r.post('/refresh', async (req, res) => {
  const token: string | undefined = req.cookies?.refresh ?? req.body?.refreshToken;
  if (!token) throw new HttpError(401, 'no_session');
  const s = await prisma.session.findUnique({ where: { refreshTokenHash: hashToken(token) } });
  if (!s || s.revokedAt || s.expiresAt < new Date()) {
    // Reuse of a rotated token suggests theft: revoke every session of that user.
    if (s) await prisma.session.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new HttpError(401, 'session_expired');
  }
  // A refresh token must never mint credentials for an account suspended since login.
  const owner = await prisma.user.findUnique({ where: { id: s.userId }, select: { status: true } });
  if (!owner || owner.status !== 'active') {
    await prisma.session.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw new HttpError(401, 'session_expired');
  }
  await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
  res.json(await issue(req, res, s.userId));
});

r.post('/logout', async (req, res) => {
  const token: string | undefined = req.cookies?.refresh ?? req.body?.refreshToken;
  if (token) await prisma.session.updateMany({ where: { refreshTokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
  res.clearCookie('refresh', { path: '/api/v1/auth' });
  res.clearCookie(MEDIA_COOKIE, { path: '/api/v1/media' });
  res.status(204).end();
});
export default r;
