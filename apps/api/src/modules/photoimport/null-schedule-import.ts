import { ScheduleImportUnavailableError, type ImageInput, type ScheduleImportPort } from './port.js'
import type { ExtractedLesson } from '@mydevtime/domain'

/**
 * The graceful-degradation default (REQ-064, mirrors ADR-0029's `NullLlm`): the
 * `ScheduleImportPort` used when no vision provider is configured or none is reachable.
 * `available()` is always false and `extractSchedule()` refuses with
 * `ScheduleImportUnavailableError`, so the import flow degrades and the deterministic core is
 * untouched (ADR-0005). It is the seam the photo-import feature tests against before any live
 * vision adapter exists (that adapter is gated on the AI/vision spike).
 */
export class NullScheduleImport implements ScheduleImportPort {
  readonly provider = 'null' as const

  extractSchedule(_image: ImageInput): Promise<readonly ExtractedLesson[]> {
    return Promise.reject(
      new ScheduleImportUnavailableError('null', 'no vision provider configured'),
    )
  }

  available(): Promise<boolean> {
    return Promise.resolve(false)
  }
}
