-- Baseline generated from all 18 approved Prisma migrations. Do not edit by hand.
CREATE TABLE `Affiliation` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `campusId` int(11) NOT NULL,
  `verificationStatus` enum('unverified','pending','verified','rejected','suspended') NOT NULL DEFAULT 'pending',
  `verifiedAt` datetime(3) DEFAULT NULL,
  `expirationAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Affiliation_userId_campusId_key` (`userId`,`campusId`),
  KEY `Affiliation_campusId_fkey` (`campusId`),
  CONSTRAINT `Affiliation_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Affiliation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Announcement` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `publishedAt` datetime(3) DEFAULT NULL,
  `pendingTitle` varchar(120) DEFAULT NULL,
  `pendingBody` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Announcement_status_publishedAt_idx` (`status`,`publishedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `AuditLog` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actorUserId` int(11) DEFAULT NULL,
  `action` varchar(191) NOT NULL,
  `targetType` varchar(191) NOT NULL,
  `targetId` int(11) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `AuditLog_actorUserId_fkey` (`actorUserId`),
  CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Campus` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Campus_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `CampusPolicy` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campusId` int(11) NOT NULL,
  `version` int(11) NOT NULL DEFAULT 1,
  `effectiveDate` datetime(3) NOT NULL,
  `approvedBy` varchar(191) NOT NULL,
  `documentRef` varchar(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CampusPolicy_campusId_version_key` (`campusId`,`version`),
  CONSTRAINT `CampusPolicy_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Category` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parentId` int(11) DEFAULT NULL,
  `name` varchar(191) NOT NULL,
  `listingType` enum('physical_product','service') NOT NULL,
  `policyRiskLevel` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `Category_parentId_fkey` (`parentId`),
  CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `GuidelineContent` (
  `id` int(11) NOT NULL,
  `draftBody` text NOT NULL,
  `publishedBody` text DEFAULT NULL,
  `updatedAt` datetime(3) NOT NULL,
  `publishedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Handoff` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inquiryThreadId` int(11) NOT NULL,
  `method` enum('campus_pickup','scheduled_meeting','seller_delivery','off_campus','digital_delivery','appointment') NOT NULL,
  `timeWindow` varchar(191) NOT NULL,
  `generalLocation` varchar(191) NOT NULL,
  `status` enum('proposed','agreed','completed','cancelled','not_confirmed') NOT NULL DEFAULT 'proposed',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Handoff_inquiryThreadId_key` (`inquiryThreadId`),
  CONSTRAINT `Handoff_inquiryThreadId_fkey` FOREIGN KEY (`inquiryThreadId`) REFERENCES `InquiryThread` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `HomePageContent` (
  `id` int(11) NOT NULL,
  `draft` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`draft`)),
  `published` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`published`)),
  `revision` int(11) NOT NULL DEFAULT 1,
  `publishedRevision` int(11) NOT NULL DEFAULT 0,
  `updatedAt` datetime(3) NOT NULL,
  `publishedAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `InquiryPreference` (
  `threadId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `muted` tinyint(1) NOT NULL DEFAULT 0,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`threadId`,`userId`),
  KEY `InquiryPreference_userId_hidden_idx` (`userId`,`hidden`),
  CONSTRAINT `InquiryPreference_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `InquiryThread` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InquiryPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `InquiryThread` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `listingId` int(11) NOT NULL,
  `buyerUserId` int(11) NOT NULL,
  `sellerProfileId` int(11) NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `InquiryThread_listingId_buyerUserId_key` (`listingId`,`buyerUserId`),
  KEY `InquiryThread_sellerProfileId_fkey` (`sellerProfileId`),
  KEY `InquiryThread_buyerUserId_fkey` (`buyerUserId`),
  CONSTRAINT `InquiryThread_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `InquiryThread_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `InquiryThread_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Listing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sellerProfileId` int(11) NOT NULL,
  `campusId` int(11) NOT NULL,
  `categoryId` int(11) NOT NULL,
  `type` enum('physical_product','service') NOT NULL,
  `title` varchar(191) NOT NULL,
  `description` text NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `priceBasis` varchar(191) NOT NULL DEFAULT 'per item',
  `currency` varchar(191) NOT NULL DEFAULT 'PHP',
  `availability` varchar(191) NOT NULL DEFAULT 'available',
  `handoffNote` varchar(200) DEFAULT NULL,
  `status` enum('draft','pending_review','changes_requested','published','rejected','suspended') NOT NULL DEFAULT 'draft',
  `flags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`flags`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `availabilityState` enum('available','reserved','sold') NOT NULL DEFAULT 'available',
  `condition` enum('new','like_new','good','fair') DEFAULT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  `reservationTransactionId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Listing_reservationTransactionId_key` (`reservationTransactionId`),
  KEY `Listing_sellerProfileId_fkey` (`sellerProfileId`),
  KEY `Listing_campusId_fkey` (`campusId`),
  KEY `Listing_categoryId_fkey` (`categoryId`),
  KEY `Listing_discovery_idx` (`status`,`categoryId`,`campusId`,`createdAt`),
  CONSTRAINT `Listing_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Listing_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Listing_reservationTransactionId_fkey` FOREIGN KEY (`reservationTransactionId`) REFERENCES `Transaction` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Listing_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingAppreciation` (
  `userId` int(11) NOT NULL,
  `listingId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`,`listingId`),
  KEY `ListingAppreciation_listingId_createdAt_idx` (`listingId`,`createdAt`),
  CONSTRAINT `ListingAppreciation_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ListingAppreciation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingInventory` (
  `listingId` int(11) NOT NULL,
  `availableQuantity` int(11) NOT NULL DEFAULT 1,
  `reservedQuantity` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`listingId`),
  CONSTRAINT `ListingInventory_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingMedia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `listingId` int(11) NOT NULL,
  `mediaPath` varchar(191) NOT NULL,
  `mimeType` varchar(191) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ListingMedia_listingId_fkey` (`listingId`),
  CONSTRAINT `ListingMedia_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingReview` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `listingId` int(11) NOT NULL,
  `reviewerId` int(11) NOT NULL,
  `decision` enum('approved','changes_requested','rejected') NOT NULL,
  `reason` text NOT NULL,
  `policyVersionId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `ListingReview_listingId_fkey` (`listingId`),
  KEY `ListingReview_reviewerId_fkey` (`reviewerId`),
  KEY `ListingReview_policyVersionId_fkey` (`policyVersionId`),
  CONSTRAINT `ListingReview_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ListingReview_policyVersionId_fkey` FOREIGN KEY (`policyVersionId`) REFERENCES `CampusPolicy` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ListingReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingViewCounter` (
  `listingId` int(11) NOT NULL,
  `viewCount` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`listingId`),
  CONSTRAINT `ListingViewCounter_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `ListingViewDedup` (
  `listingId` int(11) NOT NULL,
  `viewerHash` char(64) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`listingId`,`viewerHash`),
  KEY `ListingViewDedup_createdAt_idx` (`createdAt`),
  CONSTRAINT `ListingViewDedup_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Notification` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `type` varchar(191) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `readAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `Notification_userId_fkey` (`userId`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushAttempt` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `outboxId` int(11) NOT NULL,
  `endpointHash` char(64) NOT NULL,
  `state` varchar(16) NOT NULL DEFAULT 'pending',
  `attemptCount` int(11) NOT NULL DEFAULT 0,
  `lastStatus` varchar(32) DEFAULT NULL,
  `nextAttemptAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PushAttempt_outboxId_endpointHash_key` (`outboxId`,`endpointHash`),
  KEY `PushAttempt_state_nextAttemptAt_idx` (`state`,`nextAttemptAt`),
  CONSTRAINT `PushAttempt_outboxId_fkey` FOREIGN KEY (`outboxId`) REFERENCES `PushOutbox` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushDailyBudget` (
  `userId` int(11) NOT NULL,
  `dayKey` char(10) NOT NULL,
  `count` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`userId`,`dayKey`),
  KEY `PushDailyBudget_dayKey_idx` (`dayKey`),
  CONSTRAINT `PushDailyBudget_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushDailyMetric` (
  `dayKey` char(10) NOT NULL,
  `category` varchar(32) NOT NULL,
  `outcome` varchar(24) NOT NULL,
  `count` int(11) NOT NULL DEFAULT 0,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`dayKey`,`category`,`outcome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushOutbox` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `notificationId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `category` varchar(32) NOT NULL,
  `state` varchar(16) NOT NULL DEFAULT 'pending',
  `attemptCount` int(11) NOT NULL DEFAULT 0,
  `budgetReservedAt` datetime(3) DEFAULT NULL,
  `nextAttemptAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiresAt` datetime(3) NOT NULL,
  `leaseToken` varchar(64) DEFAULT NULL,
  `leasedUntil` datetime(3) DEFAULT NULL,
  `lastStatus` varchar(32) DEFAULT NULL,
  `sentAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PushOutbox_notificationId_key` (`notificationId`),
  KEY `PushOutbox_state_nextAttemptAt_idx` (`state`,`nextAttemptAt`),
  KEY `PushOutbox_state_leasedUntil_idx` (`state`,`leasedUntil`),
  KEY `PushOutbox_userId_createdAt_idx` (`userId`,`createdAt`),
  CONSTRAINT `PushOutbox_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PushOutbox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushPreference` (
  `userId` int(11) NOT NULL,
  `messages` tinyint(1) NOT NULL DEFAULT 1,
  `listingReviews` tinyint(1) NOT NULL DEFAULT 1,
  `accountUpdates` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `masterEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `quietStartMinute` int(11) DEFAULT NULL,
  `quietEndMinute` int(11) DEFAULT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `PushPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `PushSubscription` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `endpointHash` char(64) NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` varchar(256) NOT NULL,
  `auth` varchar(128) NOT NULL,
  `expiresAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PushSubscription_endpointHash_key` (`endpointHash`),
  KEY `PushSubscription_userId_createdAt_idx` (`userId`,`createdAt`),
  CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Report` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reporterUserId` int(11) NOT NULL,
  `listingId` int(11) DEFAULT NULL,
  `sellerProfileId` int(11) DEFAULT NULL,
  `reason` text NOT NULL,
  `status` enum('open','reviewing','resolved','dismissed') NOT NULL DEFAULT 'open',
  `assignedReviewerId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `Report_reporterUserId_fkey` (`reporterUserId`),
  KEY `Report_listingId_fkey` (`listingId`),
  KEY `Report_sellerProfileId_fkey` (`sellerProfileId`),
  KEY `Report_assignedReviewerId_fkey` (`assignedReviewerId`),
  CONSTRAINT `Report_assignedReviewerId_fkey` FOREIGN KEY (`assignedReviewerId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Report_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Report_reporterUserId_fkey` FOREIGN KEY (`reporterUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Report_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `RestrictedCategory` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `campusId` int(11) NOT NULL,
  `categoryId` int(11) NOT NULL,
  `policyAction` enum('review','prohibit') NOT NULL DEFAULT 'review',
  `policyVersionId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `RestrictedCategory_campusId_categoryId_key` (`campusId`,`categoryId`),
  KEY `RestrictedCategory_policyVersionId_fkey` (`policyVersionId`),
  KEY `RestrictedCategory_categoryId_fkey` (`categoryId`),
  CONSTRAINT `RestrictedCategory_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `RestrictedCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `RestrictedCategory_policyVersionId_fkey` FOREIGN KEY (`policyVersionId`) REFERENCES `CampusPolicy` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `SavedListing` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `listingId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `SavedListing_userId_listingId_key` (`userId`,`listingId`),
  KEY `SavedListing_listingId_fkey` (`listingId`),
  CONSTRAINT `SavedListing_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `SavedListing_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `SellerProfile` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ownerUserId` int(11) NOT NULL,
  `campusId` int(11) NOT NULL,
  `storeName` varchar(191) NOT NULL,
  `description` text NOT NULL,
  `sellerType` enum('student','establishment') NOT NULL DEFAULT 'student',
  `approvalStatus` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `avatarPath` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `SellerProfile_ownerUserId_fkey` (`ownerUserId`),
  KEY `SellerProfile_campusId_fkey` (`campusId`),
  CONSTRAINT `SellerProfile_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `SellerProfile_ownerUserId_fkey` FOREIGN KEY (`ownerUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Session` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `refreshTokenHash` varchar(191) NOT NULL,
  `device` varchar(191) NOT NULL DEFAULT '',
  `expiresAt` datetime(3) NOT NULL,
  `revokedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Session_refreshTokenHash_key` (`refreshTokenHash`),
  KEY `Session_userId_fkey` (`userId`),
  CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `StoreAppreciation` (
  `userId` int(11) NOT NULL,
  `sellerProfileId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`,`sellerProfileId`),
  KEY `StoreAppreciation_sellerProfileId_createdAt_idx` (`sellerProfileId`,`createdAt`),
  CONSTRAINT `StoreAppreciation_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `StoreAppreciation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `StoreFollow` (
  `userId` int(11) NOT NULL,
  `sellerProfileId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`,`sellerProfileId`),
  KEY `StoreFollow_sellerProfileId_createdAt_idx` (`sellerProfileId`,`createdAt`),
  CONSTRAINT `StoreFollow_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `StoreFollow_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `StoreReview` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transactionId` int(11) NOT NULL,
  `sellerProfileId` int(11) NOT NULL,
  `buyerUserId` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `body` varchar(800) DEFAULT NULL,
  `status` enum('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
  `moderationReason` varchar(500) DEFAULT NULL,
  `moderatedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `StoreReview_transactionId_key` (`transactionId`),
  KEY `StoreReview_sellerProfileId_status_createdAt_idx` (`sellerProfileId`,`status`,`createdAt`),
  KEY `StoreReview_buyerUserId_createdAt_idx` (`buyerUserId`,`createdAt`),
  CONSTRAINT `StoreReview_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `StoreReview_sellerProfileId_fkey` FOREIGN KEY (`sellerProfileId`) REFERENCES `SellerProfile` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `StoreReview_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `StoreReview_rating_range_chk` CHECK (`rating` between 1 and 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `StudentIdentity` (
  `userId` int(11) NOT NULL,
  `fullName` varchar(120) NOT NULL,
  `studentIdNumber` varchar(48) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`userId`),
  CONSTRAINT `StudentIdentity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `Transaction` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `inquiryThreadId` int(11) NOT NULL,
  `activeThreadId` int(11) DEFAULT NULL,
  `listingId` int(11) NOT NULL,
  `buyerUserId` int(11) NOT NULL,
  `sellerUserId` int(11) NOT NULL,
  `status` enum('pending','accepted','negotiating','for_meetup','completed','cancelled') NOT NULL DEFAULT 'pending',
  `price` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'PHP',
  `buyerMeetupConfirmedAt` datetime(3) DEFAULT NULL,
  `sellerMeetupConfirmedAt` datetime(3) DEFAULT NULL,
  `buyerCompletionConfirmedAt` datetime(3) DEFAULT NULL,
  `sellerCompletionConfirmedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Transaction_activeThreadId_key` (`activeThreadId`),
  KEY `Transaction_buyerUserId_status_createdAt_idx` (`buyerUserId`,`status`,`createdAt`),
  KEY `Transaction_sellerUserId_status_createdAt_idx` (`sellerUserId`,`status`,`createdAt`),
  KEY `Transaction_listingId_status_idx` (`listingId`,`status`),
  KEY `Transaction_inquiryThreadId_createdAt_idx` (`inquiryThreadId`,`createdAt`),
  CONSTRAINT `Transaction_buyerUserId_fkey` FOREIGN KEY (`buyerUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Transaction_inquiryThreadId_fkey` FOREIGN KEY (`inquiryThreadId`) REFERENCES `InquiryThread` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Transaction_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `Listing` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Transaction_sellerUserId_fkey` FOREIGN KEY (`sellerUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `TransactionStatusLog` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transactionId` int(11) NOT NULL,
  `actorUserId` int(11) NOT NULL,
  `fromStatus` enum('pending','accepted','negotiating','for_meetup','completed','cancelled') DEFAULT NULL,
  `toStatus` enum('pending','accepted','negotiating','for_meetup','completed','cancelled') NOT NULL,
  `event` varchar(40) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `TransactionStatusLog_transactionId_id_idx` (`transactionId`,`id`),
  KEY `TransactionStatusLog_actorUserId_fkey` (`actorUserId`),
  CONSTRAINT `TransactionStatusLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `TransactionStatusLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `User` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `displayName` varchar(191) NOT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `status` enum('active','suspended') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `UserRole` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `role` enum('campus_reviewer','university_admin','system_admin','establishment') NOT NULL,
  `campusId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `UserRole_userId_fkey` (`userId`),
  KEY `UserRole_campusId_fkey` (`campusId`),
  CONSTRAINT `UserRole_campusId_fkey` FOREIGN KEY (`campusId`) REFERENCES `Campus` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE `inquirymessage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `threadId` int(11) NOT NULL,
  `authorUserId` int(11) NOT NULL,
  `body` text NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `deliveredAt` datetime(3) DEFAULT NULL,
  `seenAt` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `InquiryMessage_threadId_fkey` (`threadId`),
  KEY `InquiryMessage_authorUserId_fkey` (`authorUserId`),
  CONSTRAINT `InquiryMessage_authorUserId_fkey` FOREIGN KEY (`authorUserId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `InquiryMessage_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `InquiryThread` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
