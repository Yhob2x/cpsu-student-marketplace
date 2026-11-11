import { prisma } from './db.js';
export const audit = (actorUserId: number | null, action: string, targetType: string, targetId?: number, metadata?: object) =>
  prisma.auditLog.create({ data: { actorUserId, action, targetType, targetId, metadata: metadata as any } });
export const notify = (userId: number, type: string, payload: object) =>
  prisma.notification.create({ data: { userId, type, payload: payload as any } });
