import { z } from 'zod';

export const meetupLocationBody = z.object({
  place: z.string().trim().min(3).max(74),
  timeWindow: z.string().trim().min(3).max(80),
  lat: z.number().finite().min(-85).max(85),
  lng: z.number().finite().min(-180).max(180),
  resetConfirmations: z.boolean().default(false),
}).strict();

export type MeetupLocationInput = z.infer<typeof meetupLocationBody>;

// The existing Handoff.generalLocation supports up to 120 characters.
// This suffix keeps older text-only records readable without a migration.
export function serializedMeetupLocation(input: MeetupLocationInput): string {
  return `${input.place} [geo:${input.lat.toFixed(5)},${input.lng.toFixed(5)}]`;
}
