import type { PrismaClient } from '@prisma/client';

export function assertIsolatedTestDatabase() {
  const u = new URL(process.env.DATABASE_URL || '');
  const db = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (process.env.NODE_ENV !== 'test' || process.env.CPSU_INTEGRATION_TESTS !== '1' ||
      db !== 'cpsu_marketplace_test' || !['127.0.0.1', 'localhost', '::1'].includes(u.hostname) ||
      process.env.MEDIA_STORAGE !== 'local' ||
      !process.env.UPLOAD_DIR?.includes('stage1-test-uploads')) {
    throw new Error('REFUSING destructive fixture work: isolated local test environment not confirmed.');
  }
}

export async function resetFixtures(prisma: PrismaClient) {
  assertIsolatedTestDatabase();
  // Dependency order allows foreign-key enforcement to remain ON.
  await prisma.transactionStatusLog.deleteMany();
  await prisma.listing.updateMany({ where: { reservationTransactionId: { not: null } }, data: { reservationTransactionId: null } });
  await prisma.transaction.deleteMany();
  await prisma.inquiryMessage.deleteMany();
  await prisma.handoff.deleteMany();
  await prisma.inquiryThread.deleteMany();
  await prisma.listingReview.deleteMany();
  await prisma.listingMedia.deleteMany();
  await prisma.savedListing.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.guidelineContent.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.restrictedCategory.deleteMany();
  await prisma.campusPolicy.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.affiliation.deleteMany();
  await prisma.category.deleteMany();
  await prisma.campus.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedFixtures(prisma: PrismaClient, hashPassword: (pass: string) => Promise<string>) {
  assertIsolatedTestDatabase();
  const [campusA, campusB] = await Promise.all([
    prisma.campus.create({ data: { code: 'S1A', name: 'Stage 1 campus A' } }),
    prisma.campus.create({ data: { code: 'S1B', name: 'Stage 1 campus B' } }),
  ]);
  const [category, prohibitedCategory] = await Promise.all([
    prisma.category.create({ data: { name: 'Stage1 Books', listingType: 'physical_product' } }),
    prisma.category.create({ data: { name: 'Stage1 Prohibited', listingType: 'physical_product' } }),
  ]);
  await prisma.restrictedCategory.create({ data: { campusId: campusA.id, categoryId: prohibitedCategory.id, policyAction: 'prohibit' } });

  const hash = await hashPassword('TestPassphrase-Stage1-2026!');
  type Role = 'campus_reviewer' | 'university_admin' | 'system_admin';
  async function person(key: string, campusId: number, verified = true, role?: Role, suspended = false) {
    return prisma.user.create({
      data: {
        email: key + '@stage1.invalid',
        displayName: 'Test ' + key,
        passwordHash: hash,
        status: suspended ? 'suspended' : 'active',
        affiliations: { create: { campusId, verificationStatus: verified ? 'verified' : 'pending' } },
        ...(role ? { roles: { create: { role, campusId: role === 'university_admin' ? null : campusId } } } : {}),
      },
    });
  }
  const seller = await person('seller', campusA.id);
  const otherSeller = await person('other-seller', campusB.id);
  const buyer = await person('buyer', campusA.id);
  const outsider = await person('outsider', campusB.id);
  const pending = await person('pending', campusA.id, false);
  const suspended = await person('suspended', campusA.id, true, undefined, true);
  const reviewerA = await person('reviewer-a', campusA.id, true, 'campus_reviewer');
  const reviewerB = await person('reviewer-b', campusB.id, true, 'campus_reviewer');
  const globalAdmin = await person('global-admin', campusA.id, true, 'university_admin');

  const store = await prisma.sellerProfile.create({ data: {
    ownerUserId: seller.id, campusId: campusA.id, storeName: 'Stage1 Seller', description: 'Test fixture listing store',
    approvalStatus: 'approved',
  } });
  const storeB = await prisma.sellerProfile.create({ data: {
    ownerUserId: otherSeller.id, campusId: campusB.id, storeName: 'Stage1 Other', description: 'Other test fixture store',
    approvalStatus: 'approved',
  } });
  const common = {
    type: 'physical_product' as const, categoryId: category.id, description: 'A safe test-only product description',
    price: 150, priceBasis: 'per item',
  };
  const published = await prisma.listing.create({ data: {
    ...common, sellerProfileId: store.id, campusId: campusA.id, title: 'Published Stage1 Book', status: 'published',
  } });
  const draft = await prisma.listing.create({ data: {
    ...common, sellerProfileId: store.id, campusId: campusA.id, title: 'Draft Stage1 Book', status: 'draft',
  } });
  const otherPublished = await prisma.listing.create({ data: {
    ...common, sellerProfileId: storeB.id, campusId: campusB.id, title: 'Other Campus Book', status: 'published',
  } });
  return { campusA, campusB, category, prohibitedCategory, seller, otherSeller, buyer, outsider,
    pending, suspended, reviewerA, reviewerB, globalAdmin, store, storeB, published, draft, otherPublished };
}
