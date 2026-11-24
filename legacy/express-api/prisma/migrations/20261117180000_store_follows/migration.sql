-- Additive, prepared only. DO NOT apply until backup, isolated-restore rehearsal and owner activation gate.
-- Unique membership prevents duplicate follows; cascading deletes are deliberately excluded.
CREATE TABLE `StoreFollow` (
  `userId` INTEGER NOT NULL,
  `sellerProfileId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `StoreFollow_sellerProfileId_createdAt_idx`(`sellerProfileId`, `createdAt`),
  PRIMARY KEY (`userId`, `sellerProfileId`),
  CONSTRAINT `StoreFollow_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StoreFollow_sellerProfileId_fkey`
    FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
