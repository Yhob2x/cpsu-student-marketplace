// Development seed. Campus list, categories and demo accounts are placeholders: edit to match approved CPSU policy.
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production');
const prisma = new PrismaClient();
const DEV_PASSWORD = 'DevPassword!123';

async function main() {
  const campuses = [['MAIN', 'Main Campus'], ['CAUAYAN', 'Cauayan Campus'], ['HINOBAAN', 'Hinobaan Campus'], ['ILOG', 'Ilog Campus'], ['SIPALAY', 'Sipalay Campus'], ['CANDONI', 'Candoni Campus']];
  for (const [code, name] of campuses) await prisma.campus.upsert({ where: { code }, update: {}, create: { code, name } });
  const cats: [string, 'physical_product' | 'service', number][] = [
    ['Handmade goods', 'physical_product', 0], ['Pre-loved items', 'physical_product', 0], ['Books & notes (pre-loved)', 'physical_product', 0],
    ['Food & drinks', 'physical_product', 2], ['Printing & school supplies', 'physical_product', 2],
    ['Design & creative', 'service', 0], ['Tutoring', 'service', 1], ['Tech & IT help', 'service', 0], ['Photography & video', 'service', 0],
  ];
  for (const [name, listingType, policyRiskLevel] of cats)
    if (!await prisma.category.findFirst({ where: { name } })) await prisma.category.create({ data: { name, listingType, policyRiskLevel } });
  const food = await prisma.category.findFirstOrThrow({ where: { name: 'Food & drinks' } });
  for (const c of await prisma.campus.findMany()) {
    const policy = await prisma.campusPolicy.upsert({ where: { campusId_version: { campusId: c.id, version: 1 } }, update: {},
      create: { campusId: c.id, version: 1, effectiveDate: new Date(), approvedBy: 'PLACEHOLDER - pending CPSU approval', documentRef: 'docs/campus-policy-rules.md' } });
    if (!await prisma.restrictedCategory.findFirst({ where: { campusId: c.id, categoryId: food.id } }))
      await prisma.restrictedCategory.create({ data: { campusId: c.id, categoryId: food.id, policyAction: 'review', policyVersionId: policy.id } });
  }
  const hash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  const cauayan = await prisma.campus.findUniqueOrThrow({ where: { code: 'CAUAYAN' } });
  const people = [
    { email: 'seller@dev.test', displayName: 'Demo Seller', status: 'verified' as const, role: null },
    { email: 'buyer@dev.test', displayName: 'Demo Buyer', status: 'verified' as const, role: null },
    { email: 'reviewer@dev.test', displayName: 'Cauayan Reviewer', status: 'verified' as const, role: 'campus_reviewer' as const },
    { email: 'admin@dev.test', displayName: 'University Admin', status: 'verified' as const, role: 'university_admin' as const },
  ];
  for (const p of people) {
    const u = await prisma.user.upsert({ where: { email: p.email }, update: {}, create: { email: p.email, displayName: p.displayName, passwordHash: hash } });
    await prisma.affiliation.upsert({ where: { userId_campusId: { userId: u.id, campusId: cauayan.id } }, update: {}, create: { userId: u.id, campusId: cauayan.id, verificationStatus: p.status, verifiedAt: new Date() } });
    if (p.role && !await prisma.userRole.findFirst({ where: { userId: u.id, role: p.role } }))
      await prisma.userRole.create({ data: { userId: u.id, role: p.role, campusId: p.role === 'university_admin' ? null : cauayan.id } });
  }
  console.log(`Seeded. Dev accounts: seller@/buyer@/reviewer@/admin@dev.test, password ${DEV_PASSWORD}`);
}
main().finally(() => prisma.$disconnect());
