/** The seller's existing eligibility rule also governs public storefront exposure. */
export function visibleStudentStoreWhere(now = new Date()) {
  return {
    approvalStatus: 'approved' as const,
    sellerType: 'student' as const,
    owner: { status: 'active' as const, roles: { none: {} }, affiliations: { some: {
      verificationStatus: 'verified' as const,
      campus: { active: true },
      OR: [{ expirationAt: null }, { expirationAt: { gt: now } }],
    } } },
  };
}
