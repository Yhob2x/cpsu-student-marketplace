import { prisma } from './db.js';
import { pushOutboxWritesActivated, stagePushOutbox } from './push-outbox.js';
export const audit = (actorUserId: number | null, action: string, targetType: string, targetId?: number, metadata?: object) =>
  prisma.auditLog.create({ data: { actorUserId, action, targetType, targetId, metadata: metadata as any } });
export const notify = async (userId: number, type: string, payload: object) => {
  return pushOutboxWritesActivated
    ? prisma.$transaction(async tx => {
        const row = await tx.notification.create({ data: { userId, type, payload: payload as any } });
        await stagePushOutbox(tx, { id: row.id, userId, type });
        return row;
      })
    : prisma.notification.create({ data: { userId, type, payload: payload as any } });
};
