/**
 * The `wellbeing` module's public surface (module-boundary rule, ADR-0025 §seams): other
 * modules — today the `ai` module's Evening Companion — consume the injectable
 * `WellbeingService` (day-load upsert/history + the consented mood read) through this file
 * only. The controller, context and the raw store functions stay private; in particular the
 * mood **write** path remains behind `POST /api/wellbeing/mood` and its server-side consent
 * gate — no other module can store a mood.
 */
export { WellbeingService } from './service.js'
export type { DayLoadScope, LoadHistoryDay, MoodDay, RecordDayLoadInput } from './service.js'
