import { Prisma } from '@prisma/client';
import { prisma } from './db.js';

// The avatar migration is approval-gated and may not yet exist on this database.
// Public browsing must not depend on that optional column being deployed.
let supported: Promise<boolean> | undefined;

export function sellerAvatarColumnExists(): Promise<boolean> {
  if (!supported) {
    supported = prisma.$queryRaw<Array<{ present: number }>>(Prisma.sql`
      SELECT 1 AS present FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SellerProfile'
        AND COLUMN_NAME = 'avatarPath' LIMIT 1
    `).then(rows => rows.length > 0).catch(error => {
      supported = undefined; // A transient DB error must not be cached as 'missing'.
      throw error;
    });
  }
  return supported;
}
