-- AlterTable
ALTER TABLE `Listing` ADD COLUMN `availabilityState` ENUM('available', 'reserved', 'sold') NOT NULL DEFAULT 'available',
    ADD COLUMN `condition` ENUM('new', 'like_new', 'good', 'fair') NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL;
