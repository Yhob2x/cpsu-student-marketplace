import { categoryForNotice, pushDeliveryReady, type PushCategory } from './push.js';

export type EnqueuedNotice = {
  id: number;
  userId: number;
  type: string;
};

export type OutboxInsert = {
  notificationId: number;
  userId: number;
  category: PushCategory;
  expiresAt: Date;
};

/** Narrow injectable boundary: caller MUST pass its existing DB transaction. */
export type PushOutboxWritePort = {
  pushOutbox: { create: (args: { data: OutboxInsert }) => Promise<unknown> };
};

export const OUTBOX_TTL_MS = 60 * 60_000;

/**
 * This function must be called within the SAME SQL transaction that created
 * the referenced Notification. A failure rolls back both and never leaves a
 * published notice without a matching queue record when enabled.
 * No payload, message text, capability URL, or device key is persisted here.
 */
export async function insertPushOutbox(
  tx: PushOutboxWritePort,
  notice: EnqueuedNotice,
  now = new Date(),
): Promise<boolean> {
  const category = categoryForNotice(notice.type);
  if (!category) return false;
  if (!Number.isSafeInteger(notice.id) || notice.id < 1
    || !Number.isSafeInteger(notice.userId) || notice.userId < 1
    || !Number.isFinite(now.getTime())) throw new Error('Invalid push outbox notice');
  await tx.pushOutbox.create({ data: {
    notificationId: notice.id,
    userId: notice.userId,
    category,
    expiresAt: new Date(now.getTime() + OUTBOX_TTL_MS),
  } });
  return true;
}

/**
 * Producer writes and delivery use the same release gate.
 */
export const pushOutboxWritesActivated = pushDeliveryReady;

export async function stagePushOutbox(
  tx: PushOutboxWritePort,
  notice: EnqueuedNotice,
): Promise<void> {
  if (!pushOutboxWritesActivated) return;
  await insertPushOutbox(tx, notice);
}
