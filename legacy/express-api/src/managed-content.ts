import { z } from 'zod';

export const DEFAULT_GUIDELINES = `# What you can list
Student-made goods, pre-loved items, and skills-based services such as design, tutoring and IT help.

# What gets a closer look
Food, drinks, printing and school supplies may overlap with campus establishments. A campus reviewer checks these before they appear, and may restrict them under the campus rules.

# Not allowed
Paid cheating or impersonation, harassment, and anything prohibited by campus or national rules.

# Meeting and paying
You and the other person agree on payment and handoff. Meet at a campus pickup spot where possible. The marketplace never holds money.

# Problems
Use Report on any listing. A reviewer looks at it and records the outcome.`;

export const plainContent = (max: number) => z.string().trim().min(1).max(max)
  .refine(value => !/[<>]/.test(value), 'HTML markup is not allowed');
