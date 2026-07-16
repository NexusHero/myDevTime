import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Preference-patch DTO (M10): every toggle optional, so the client PUTs only what
 * changed. Unknown keys are stripped by the schema; the service merges the rest
 * onto the stored values (and the defaults).
 */
const patchSchema = z
  .object({
    reminders: z.boolean(),
    idleDetection: z.boolean(),
    weekStartMonday: z.boolean(),
    meetingConsent: z.boolean(),
    breakReminders: z.boolean(),
    calendarSync: z.boolean(),
    autoTracker: z.boolean(),
    onboarded: z.boolean(),
  })
  .partial()

export class UpdatePreferencesDto extends createZodDto(patchSchema) {}
