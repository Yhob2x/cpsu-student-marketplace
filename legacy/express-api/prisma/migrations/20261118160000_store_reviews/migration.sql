-- ADDITIVE MIGRATION, STAGED AND NOT APPLIED TO THE DEVELOPMENT DATABASE.
-- Requires explicit separate approval and isolated restore/test acceptance first.
CREATE TABLE `StoreReview` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `transactionId` INTEGER NOT NULL,
  `sellerProfileId` INTEGER NOT NULL,
  `buyerUserId` INTEGER NOT NULL,
  `rating` INTEGER NOT NULL,
  `body` VARCHAR(800) NULL,
  `status` ENUM('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
  `moderationReason` VARCHAR(500) NULL,
  `moderatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StoreReview_transactionId_key` (`transactionId`),
  INDEX `StoreReview_sellerProfileId_status_createdAt_idx` (`sellerProfileId`, `status`, `createdAt`),
  INDEX `StoreReview_buyerUserId_createdAt_idx` (`buyerUserId`, `createdAt`),
  CONSTRAINT `StoreReview_rating_range_chk` CHECK (`rating` BETWEEN 1 AND 5),
  CONSTRAINT `StoreReview_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StoreReview_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `StoreReview_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
