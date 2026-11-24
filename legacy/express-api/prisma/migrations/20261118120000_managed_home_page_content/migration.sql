CREATE TABLE `HomePageContent` (
    `id` INTEGER NOT NULL,
    `draft` JSON NOT NULL,
    `published` JSON NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `publishedRevision` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
