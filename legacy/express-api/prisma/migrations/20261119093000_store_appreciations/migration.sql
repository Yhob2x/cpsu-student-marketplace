-- Additive, staged migration. DO NOT APPLY without isolated restore rehearsal and DB approval.
-- Appreciations are reversible and do not count as ratings or transaction endorsements.
CREATE TABLE `StoreAppreciation` (
  `userId` INTEGER NOT NULL,
  `sellerProfileId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `sellerProfileId`),
  INDEX `StoreAppreciation_sellerProfileId_createdAt_idx` (`sellerProfileId`, `createdAt`),
  CONSTRAINT `StoreAppreciation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StoreAppreciation_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
