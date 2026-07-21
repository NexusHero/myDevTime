import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Preference-patch DTO (M10): every toggle optional, so the client PUTs only what
 * changed. Unknown keys are stripped by the schema; the service merges the rest
 * onto the stored values (and the defaults). The quiet-hours minutes (ADR-0071)
 * are whole minutes of day, 0..1439 — a live patch outside that fails loudly here
 * rather than being silently bent by the merge's clamp.
 */
const minuteOfDay = z.number().int().min(0).max(1439)

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
    seviProactive: z.boolean(),
    moodConsent: z.boolean(),
    quietStartMin: minuteOfDay,
    quietEndMin: minuteOfDay,
    // Calm-canvas layer chips + Sevi first-run flag (ADR-0072 D3, REQ-074) — appended only.
    plannerLayerReality: z.boolean(),
    plannerLayerGhosts: z.boolean(),
    plannerLayerLife: z.boolean(),
    plannerLayerCapacity: z.boolean(),
    plannerFirstRunDone: z.boolean(),
  })
  .partial()

export class UpdatePreferencesDto extends createZodDto(patchSchema) {}
