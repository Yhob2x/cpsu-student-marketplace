import type { Prisma } from '@prisma/client';
import { HttpError } from './http.js';

/** Only open inquiry threads may receive new messages, regardless of entry route. */
export function inquiryAllowsMessage(status: string): boolean {
  return status === 'open';
}

/**
 * Call ONLY inside a SERIALIZABLE transaction. InnoDB locks this row for the
 * duration of the transaction, serializing a send against the close operation.
 * Never notify about a rejected insert.
 */
export async function appendMessageToOpenThread(
  tx: Prisma.TransactionClient, threadId: number, authorUserId: number, body: string,
) {
  const thread = await tx.inquiryThread.findUnique({
    where: { id: threadId }, select: { status: true },
  });
  if (!thread || !inquiryAllowsMessage(thread.status)) throw new HttpError(409, 'thread_closed');
  return tx.inquiryMessage.create({ data: { threadId, authorUserId, body } });
}
