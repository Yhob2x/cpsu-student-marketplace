-- STAGED ONLY: additive Web Push outbox and server-enforced preference state.
-- DO NOT APPLY to development, staging or production without a guarded restore
-- rehearsal, privacy/retention review and explicit database activation.
-- Existing in-app Notification rows and delivery release switches are untouched.
ALTER TABLE `PushPreference`
  ADD COLUMN `masterEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `quietStartMinute` INTEGER NULL,
  ADD COLUMN `quietEndMinute` INTEGER NULL;

CREATE TABLE `PushOutbox` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `notificationId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `category` VARCHAR(32) NOT NULL,
  `state` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `budgetReservedAt` DATETIME(3) NULL,
  `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `leaseToken` VARCHAR(64) NULL,
  `leasedUntil` DATETIME(3) NULL,
  `lastStatus` VARCHAR(32) NULL,
  `sentAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PushOutbox_notificationId_key`(`notificationId`),
  INDEX `PushOutbox_state_nextAttemptAt_idx`(`state`, `nextAttemptAt`),
  INDEX `PushOutbox_state_leasedUntil_idx`(`state`, `leasedUntil`),
  INDEX `PushOutbox_userId_createdAt_idx`(`userId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PushOutbox_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PushOutbox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushAttempt` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `outboxId` INTEGER NOT NULL,
  `endpointHash` CHAR(64) NOT NULL,
  `state` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `attemptCount` INTEGER NOT NULL DEFAULT 0,
  `lastStatus` VARCHAR(32) NULL,
  `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PushAttempt_outboxId_endpointHash_key`(`outboxId`, `endpointHash`),
  INDEX `PushAttempt_state_nextAttemptAt_idx`(`state`, `nextAttemptAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PushAttempt_outboxId_fkey` FOREIGN KEY (`outboxId`) REFERENCES `PushOutbox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushDailyBudget` (
  `userId` INTEGER NOT NULL,
  `dayKey` CHAR(10) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PushDailyBudget_dayKey_idx`(`dayKey`),
  PRIMARY KEY (`userId`, `dayKey`),
  CONSTRAINT `PushDailyBudget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PushDailyMetric` (
  `dayKey` CHAR(10) NOT NULL,
  `category` VARCHAR(32) NOT NULL,
  `outcome` VARCHAR(24) NOT NULL,
  `count` INTEGER NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`dayKey`, `category`, `outcome`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
