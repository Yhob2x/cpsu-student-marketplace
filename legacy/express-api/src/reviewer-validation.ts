import { z } from 'zod';

const email = z.string().trim().email().max(191).toLowerCase();
const displayName = z.string().trim().min(2).max(80);
const password = z.string().min(12).max(128);
const campusId = z.number().int().positive();

export const reviewerCreateSchema = z.object({ email, displayName, password, campusId }).strict();
export const reviewerEditSchema = z.object({
  email: email.optional(), displayName: displayName.optional(), password: password.optional(),
  campusId: campusId.optional(), status: z.enum(['active', 'suspended']).optional(),
  reason: z.string().trim().min(10).max(500),
}).strict().refine(value => ['email', 'displayName', 'password', 'campusId', 'status'].some(key => key in value),
  'At least one reviewer detail must change.');
