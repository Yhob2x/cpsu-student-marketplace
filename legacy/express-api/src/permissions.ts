// Pure authorization helpers (no database access) so they are easy to unit test.
export type AuthUser = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[] };

export const staffRoles = ['campus_reviewer', 'university_admin', 'system_admin', 'establishment'] as const;
export const isStaffAccount = (roles: AuthUser['roles']) => roles.some(({ role }) => (staffRoles as readonly string[]).includes(role));

// Only university-wide administrators maintain shared campuses and category names.
export const canManageCatalog = (u: AuthUser) =>
  u.roles.some(role => role.role === 'university_admin' && role.campusId === null);

// Campus-scoped review authority. System administrators deliberately cannot approve listings.
export const canReview = (u: AuthUser, campusId: number) =>
  u.roles.some(r => (r.role === 'campus_reviewer' && r.campusId === campusId) ||
                    (r.role === 'university_admin' && (r.campusId === null || r.campusId === campusId)));

export const reviewCampusIds = (u: AuthUser): number[] | 'all' => {
  if (u.roles.some(r => r.role === 'university_admin' && r.campusId === null)) return 'all';
  return u.roles.filter(r => r.campusId !== null && ['campus_reviewer', 'university_admin'].includes(r.role)).map(r => r.campusId!);
};

// Material changes after approval send the listing back to review.
export const isMaterialChange = (patch: Record<string, unknown>, current?: Record<string, unknown>) =>
  ['title', 'description', 'categoryId', 'type', 'campusId', 'condition'].some(k =>
    k in patch && (!current || (patch[k] ?? null) !== (current[k] ?? null)));
