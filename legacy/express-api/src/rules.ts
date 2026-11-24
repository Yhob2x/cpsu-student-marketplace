import { prisma } from './db.js';
// Flags possible overlap with campus establishments. It only flags: a human reviewer decides.
const OVERLAP_TERMS = ['food', 'meal', 'snack', 'drink', 'coffee', 'milk tea', 'lunch', 'printing', 'photocopy', 'xerox', 'school supplies', 'uniform', 'ballpen'];
const INTEGRITY_TERMS = ['do your assignment', 'write your thesis', 'take your exam', 'ghostwrit', 'impersonat'];

export async function evaluateListing(l: { title: string; description: string; categoryId: number; campusId: number; price: any }, imageCount: number) {
  const flags: string[] = [];
  const text = `${l.title} ${l.description}`.toLowerCase();
  const cat = await prisma.category.findUnique({ where: { id: l.categoryId } });
  if (cat && cat.policyRiskLevel > 0) flags.push('sensitive_category');
  const restricted = await prisma.restrictedCategory.findFirst({ where: { campusId: l.campusId, categoryId: l.categoryId }, include: { policy: true } });
  if (restricted) flags.push(restricted.policyAction === 'prohibit' ? 'restricted_prohibited' : 'restricted_review');
  if (OVERLAP_TERMS.some(t => text.includes(t))) flags.push('possible_establishment_overlap');
  if (INTEGRITY_TERMS.some(t => text.includes(t))) flags.push('academic_integrity_concern');
  if (imageCount === 0) flags.push('missing_images');
  if (Number(l.price) <= 0) flags.push('invalid_price');
  const policyVersionId = restricted?.policyVersionId ?? null;
  return { flags, policyVersionId };
}
export { isMaterialChange } from './permissions.js';
