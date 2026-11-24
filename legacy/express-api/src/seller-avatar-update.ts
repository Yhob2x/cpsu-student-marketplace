import type { PrismaClient } from '@prisma/client';
import { HttpError } from './http.js';

// Replace only the owner's active store image. The conditional write prevents
// concurrent uploads or removals from silently overwriting a newer choice.
// The audit record commits in the same transaction as the image reference.
export async function publishSellerAvatar(
  db: Pick<PrismaClient, '$transaction'>, ownerUserId: number, mediaPath: string,
) {
  return db.$transaction(async tx => {
    const store = await tx.sellerProfile.findFirst({
      where: { ownerUserId, approvalStatus: 'approved' },
      select: { id: true, avatarPath: true },
    });
    if (!store) throw new HttpError(403, 'no_approved_store');
    const changed = await tx.sellerProfile.updateMany({
      where: { id: store.id, ownerUserId, avatarPath: store.avatarPath, approvalStatus: 'approved' },
      data: { avatarPath: mediaPath },
    });
    if (changed.count !== 1) throw new HttpError(409, 'avatar_changed',
      'Your store photo changed during upload. Refresh the page and try again.');
    await tx.auditLog.create({ data: {
      actorUserId: ownerUserId, action: 'seller.avatar_published',
      targetType: 'seller_profile', targetId: store.id,
    } });
    return { id: store.id, previousPath: store.avatarPath };
  });
}
