// Pure authorization helpers (no database access) so they are easy to unit test.
export type AuthUser = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[] };

// Campus-scoped review authority. System administrators deliberately cannot approve listings.
export const canReview = (u: AuthUser, campusId: number) =>
  u.roles.some(r => (r.role === 'campus_reviewer' && r.campusId === campusId) ||
                    (r.role === 'university_admin' && (r.campusId === null || r.campusId === campusId)));

export const reviewCampusIds = (u: AuthUser): number[] | 'all' => {
  if (u.roles.some(r => r.role === 'university_admin' && r.campusId === null)) return 'all';
  return u.roles.filter(r => r.campusId !== null && ['campus_reviewer', 'university_admin'].includes(r.role)).map(r => r.campusId!);
};

// Material changes after approval send the listing back to review.
export const isMaterialChange = (patch: Record<string, unknown>) =>
  ['title', 'description', 'categoryId', 'type', 'campusId', 'condition'].some(k => k in patch);
