-- Per-student mute and inbox removal; never delete messages or shared inquiry records.
CREATE TABLE `InquiryPreference` (
  `threadId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `muted` BOOLEAN NOT NULL DEFAULT false,
  `hidden` BOOLEAN NOT NULL DEFAULT false,
  INDEX `InquiryPreference_userId_hidden_idx`(`userId`, `hidden`),
  PRIMARY KEY (`threadId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InquiryPreference` ADD CONSTRAINT `InquiryPreference_threadId_fkey`
  FOREIGN KEY (`threadId`) REFERENCES `InquiryThread`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `InquiryPreference` ADD CONSTRAINT `InquiryPreference_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
