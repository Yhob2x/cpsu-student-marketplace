import { z } from 'zod';

// No CPSU-specific number format is assumed before institutional approval.
// Keep a student number as a string (leading zeroes must survive intact).
const printable = (value: string) => !/[\u0000-\u001F\u007F]/u.test(value);
export const studentIdentityRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120).refine(printable, 'Enter a valid full name.'),
  studentIdNumber: z.string().trim().min(3).max(48)
    .refine(printable, 'Enter a valid student ID number.'),
}).strict();
