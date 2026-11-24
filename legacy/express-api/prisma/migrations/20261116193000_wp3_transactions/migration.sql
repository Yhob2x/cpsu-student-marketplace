-- AlterTable
ALTER TABLE `Listing` ADD COLUMN `reservationTransactionId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inquiryThreadId` INTEGER NOT NULL,
    `activeThreadId` INTEGER NULL,
    `listingId` INTEGER NOT NULL,
    `buyerUserId` INTEGER NOT NULL,
    `sellerUserId` INTEGER NOT NULL,
    `status` ENUM('pending', 'accepted', 'negotiating', 'for_meetup', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `price` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'PHP',
    `buyerMeetupConfirmedAt` DATETIME(3) NULL,
    `sellerMeetupConfirmedAt` DATETIME(3) NULL,
    `buyerCompletionConfirmedAt` DATETIME(3) NULL,
    `sellerCompletionConfirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Transaction_activeThreadId_key`(`activeThreadId`),
    INDEX `Transaction_buyerUserId_status_createdAt_idx`(`buyerUserId`, `status`, `createdAt`),
    INDEX `Transaction_sellerUserId_status_createdAt_idx`(`sellerUserId`, `status`, `createdAt`),
    INDEX `Transaction_listingId_status_idx`(`listingId`, `status`),
    INDEX `Transaction_inquiryThreadId_createdAt_idx`(`inquiryThreadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransactionStatusLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` INTEGER NOT NULL,
    `actorUserId` INTEGER NOT NULL,
    `fromStatus` ENUM('pending', 'accepted', 'negotiating', 'for_meetup', 'completed', 'cancelled') NULL,
    `toStatus` ENUM('pending', 'accepted', 'negotiating', 'for_meetup', 'completed', 'cancelled') NOT NULL,
    `event` VARCHAR(40) NOT NULL,
    `reason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TransactionStatusLog_transactionId_id_idx`(`transactionId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Listing_reservationTransactionId_key` ON `Listing`(`reservationTransactionId`);

-- AddForeignKey
ALTER TABLE `Listing` ADD CONSTRAINT `Listing_reservationTransactionId_fkey` FOREIGN KEY (`reservationTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_inquiryThreadId_fkey` FOREIGN KEY (`inquiryThreadId`) REFERENCES `InquiryThread`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_sellerUserId_fkey` FOREIGN KEY (`sellerUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionStatusLog` ADD CONSTRAINT `TransactionStatusLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransactionStatusLog` ADD CONSTRAINT `TransactionStatusLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
