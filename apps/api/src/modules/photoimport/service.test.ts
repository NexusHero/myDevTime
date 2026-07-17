import { describe, expect, it } from 'vitest'
import type { ExtractedLesson } from '@mydevtime/domain'
import { PHOTO_IMPORT_CREDIT_COST, planPhotoImport, type PhotoImportGates } from './service.js'
import { NullScheduleImport } from './null-schedule-import.js'
import { ScheduleImportUnavailableError, type ImageInput, type ScheduleImportPort } from './port.js'

// A Monday, UTC midnight.
const MON = Date.parse('2026-07-06T00:00:00Z')
const image: ImageInput = { base64: 'AAAA', mimeType: 'image/jpeg' }
const lesson: ExtractedLesson = { title: 'Mathematics', weekday: 3, startMin: 480, lenMin: 45 }
const openGates = (over: Partial<PhotoImportGates> = {}): PhotoImportGates => ({
  hasPro: true,
  consented: true,
  fromDateMs: MON,
  ...over,
})

/** A tiny in-memory vision adapter for the seam tests — the live vision adapter is spike-gated. */
class FakeVision implements ScheduleImportPort {
  readonly provider = 'vision' as const
  constructor(
    private readonly lessons: readonly ExtractedLesson[],
    private readonly up = true,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.up)
  }
  extractSchedule(_image: ImageInput): Promise<readonly ExtractedLesson[]> {
    if (!this.up) return Promise.reject(new ScheduleImportUnavailableError('vision'))
    return Promise.resolve(this.lessons)
  }
}

describe('planPhotoImport', () => {
  it('WithoutPro_ProposesNothing_evenWithAWorkingModel', async () => {
    const plan = await planPhotoImport(
      new FakeVision([lesson]),
      image,
      openGates({ hasPro: false }),
    )
    expect(plan.status).toBe('not-pro')
    expect(plan.proposals).toEqual([])
  })

  it('WithoutConsent_ProposesNothing', async () => {
    const plan = await planPhotoImport(
      new FakeVision([lesson]),
      image,
      openGates({ consented: false }),
    )
    expect(plan.status).toBe('no-consent')
    expect(plan.proposals).toEqual([])
  })

  it('ProAndConsented_ProposesGhostSeries_neverBooked', async () => {
    const plan = await planPhotoImport(new FakeVision([lesson]), image, openGates())
    expect(plan.status).toBe('ok')
    expect(plan.proposals).toHaveLength(1)
    const p = plan.proposals[0]
    expect(p?.source).toBe('ai-proposal')
    expect(p?.confirmed).toBe(false)
    expect(p?.rule).toEqual({ freq: 'weekly', end: { kind: 'never' } })
  })

  it('UnavailableModel_DegradesToEmptyPlan', async () => {
    const plan = await planPhotoImport(new FakeVision([lesson], false), image, openGates())
    expect(plan.status).toBe('unavailable')
    expect(plan.proposals).toEqual([])
  })

  it('NullAdapter_IsAlwaysUnavailable_NeverProposes', async () => {
    const plan = await planPhotoImport(new NullScheduleImport(), image, openGates())
    expect(plan.status).toBe('unavailable')
    expect(plan.proposals).toEqual([])
  })

  it('CreditCostIsOne_andIsInformationalNotChargedHere', async () => {
    const plan = await planPhotoImport(new FakeVision([lesson]), image, openGates())
    expect(plan.creditCost).toBe(PHOTO_IMPORT_CREDIT_COST)
    expect(PHOTO_IMPORT_CREDIT_COST).toBe(1)
  })
})

describe('NullScheduleImport', () => {
  it('AvailableIsFalse_AndExtractRejects', async () => {
    const port = new NullScheduleImport()
    expect(await port.available()).toBe(false)
    await expect(port.extractSchedule(image)).rejects.toBeInstanceOf(ScheduleImportUnavailableError)
  })
})
