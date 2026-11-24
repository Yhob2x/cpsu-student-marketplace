-- PREPARED ONLY. DO NOT APPLY before CPSU DPO retention approval, isolated migration testing,
-- verified backup/restore and separate owner approval for development activation.
-- Never copy student ID numbers into public profiles, notices, logs or analytics.
-- No uniqueness is assumed for university ID numbers until CPSU decides cross-campus rules.
CREATE TABLE `StudentIdentity` (
  `userId` INTEGER NOT NULL,
  `fullName` VARCHAR(120) NOT NULL,
  `studentIdNumber` VARCHAR(48) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`),
  CONSTRAINT `StudentIdentity_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
