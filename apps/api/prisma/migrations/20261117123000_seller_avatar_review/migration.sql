-- Additive migration, still unapplied as verified on 2026-11-17.
-- Seller avatars publish on successful seller-authorized upload; no review column.
ALTER TABLE `SellerProfile`
  ADD COLUMN `avatarPath` VARCHAR(255) NULL;
