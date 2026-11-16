import { prisma } from './db.js';
import { deliverPush } from './push.js';
export const audit = (actorUserId: number | null, action: string, targetType: string, targetId?: number, metadata?: object) =>
  prisma.auditLog.create({ data: { actorUserId, action, targetType, targetId, metadata: metadata as any } });
export const notify = async (userId: number, type: string, payload: object) => {
  // First persist the existing in-app notification, then try a private opt-in push.
  // A push-provider failure must never prevent a message or moderation action.
  const notice = await prisma.notification.create({ data: { userId, type, payload: payload as any } });
  void deliverPush(userId, type, payload as Record<string, unknown>, notice.id)
    .catch(() => console.warn('Web Push delivery skipped'));
  return notice;
};
