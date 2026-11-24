-- Additive migration. Apply only after an isolated restore rehearsal and database authorization.
-- Keep historical StoreAppreciation records; do not attribute store hearts to arbitrary products.
CREATE TABLE `ListingInventory` (
  `listingId` INTEGER NOT NULL,
  `availableQuantity` INTEGER NOT NULL DEFAULT 1,
  `reservedQuantity` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`listingId`),
  CONSTRAINT `ListingInventory_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Existing one-off physical listings start with one unit unless already sold.
-- In-flight transaction reservations preserve their held unit and can still complete/cancel.
-- A seller-paused listing retains one unit but remains hidden until reactivated.
INSERT INTO `ListingInventory` (`listingId`, `availableQuantity`, `reservedQuantity`)
SELECT `id`,
  CASE WHEN `availabilityState` = 'sold' THEN 0
       WHEN `reservationTransactionId` IS NOT NULL THEN 0
       ELSE 1 END,
  CASE WHEN `reservationTransactionId` IS NOT NULL THEN 1 ELSE 0 END
FROM `Listing` WHERE `type` = 'physical_product';

CREATE TABLE `ListingAppreciation` (
  `userId` INTEGER NOT NULL,
  `listingId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`, `listingId`),
  INDEX `ListingAppreciation_listingId_createdAt_idx` (`listingId`, `createdAt`),
  CONSTRAINT `ListingAppreciation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ListingAppreciation_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
