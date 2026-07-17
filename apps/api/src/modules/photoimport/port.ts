import type { ExtractedLesson } from '@mydevtime/domain'

/**
 * The one narrow schedule-extraction interface the app sees (REQ-064, design v17 §F6 KI5; skill
 * §2.2). A vision model reads a photographed timetable (or a forwarded school mail) and *proposes*
 * structured lessons; every provider is reached through a single adapter that confines its
 * SDK/auth to that file and returns the neutral domain `ExtractedLesson[]`. **Nothing upstream
 * imports a vendor type.** The port only *extracts* — it never books; the deterministic
 * `toSeriesProposals` core turns lessons into ghost series the user confirms (ADR-0005). The live
 * vision adapter is gated on the AI/vision spike; the Null adapter ships now as the seam.
 */

export type ScheduleImportProvider = 'vision' | 'null'

/** A photo/scan to read — a neutral wrapper; vendor image types stay inside the adapter. */
export interface ImageInput {
  /** Base64-encoded image bytes. */
  readonly base64: string
  /** MIME type, e.g. `image/jpeg`. */
  readonly mimeType: string
}

/**
 * The narrow schedule-import port. A feature depends on this, never a vision SDK; the concrete
 * adapter is selected by config at composition time. Implementations extract only — they never
 * mutate app state (booking is the confirmed-proposal flow's job, over the deterministic core).
 */
export interface ScheduleImportPort {
  readonly provider: ScheduleImportProvider
  /** Extract lessons from an image. Throws `ScheduleImportUnavailableError` when the model is down. */
  extractSchedule(image: ImageInput): Promise<readonly ExtractedLesson[]>
  /** Whether the vision model is configured and reachable (cheap; no extraction). */
  available(): Promise<boolean>
}

/**
 * Thrown when no vision provider is configured or the chosen one is unreachable. The import flow
 * handles this and degrades — the deterministic core never depends on the model being up
 * (ADR-0005).
 */
export class ScheduleImportUnavailableError extends Error {
  readonly provider: ScheduleImportProvider
  constructor(provider: ScheduleImportProvider, message = 'schedule import is not available') {
    super(message)
    this.name = 'ScheduleImportUnavailableError'
    this.provider = provider
  }
}
