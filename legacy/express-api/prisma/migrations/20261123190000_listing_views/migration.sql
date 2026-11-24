-- Additive, no backfill of imaginary historic views. Apply only after approved private backup and isolated restore rehearsal.
-- No IP address, user ID, user agent, or raw browser token is persisted.
CREATE TABLE `ListingViewCounter` (
  `listingId` INTEGER NOT NULL,
  `viewCount` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`listingId`),
  CONSTRAINT `ListingViewCounter_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ephemeral HMAC digest is scoped to a listing and UTC day; duplicate visits are ignored.
-- Opportunistic deletion in the write path removes hashes after two days.
CREATE TABLE `ListingViewDedup` (
  `listingId` INTEGER NOT NULL,
  `viewerHash` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`listingId`, `viewerHash`),
  INDEX `ListingViewDedup_createdAt_idx` (`createdAt`),
  CONSTRAINT `ListingViewDedup_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
