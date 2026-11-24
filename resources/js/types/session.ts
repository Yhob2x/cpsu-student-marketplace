export type Me = { id: number; email: string; displayName: string; roles: { role: string; campusId: number | null }[];
  affiliations: { id: number; campus: { id: number; name: string }; status: string }[]; storeId: number | null };
